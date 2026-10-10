// =====================================================================
// Alarmas diarias por mail — lo ejecuta GitHub Actions todos los días.
//   • Primer aviso cuando faltan 5 días para el vencimiento (carga o PH).
//   • Recordatorio el día en que vence.
//   Nada más: lo demás (observados, inspecciones atrasadas) se ve en la app.
// Secrets obligatorios (GitHub > Settings > Secrets and variables > Actions):
//   SUPABASE_SERVICE_KEY, SMTP_USER, SMTP_PASS
// Opcionales: SMTP_HOST (def. smtp.gmail.com), SMTP_PORT (def. 465), MAIL_FROM
// SUPABASE_URL y APP_URL vienen fijados en .github/workflows/alarmas.yml
// =====================================================================
import nodemailer from "nodemailer";

const env = process.env;
const URL_SB = (env.SUPABASE_URL || "").replace(/\/$/, "");
const KEY = env.SUPABASE_SERVICE_KEY;
const AVISO = Number(env.DIAS_AVISO || 5); // días de anticipación del primer aviso
const APP = env.APP_URL || "";
if (!URL_SB || !KEY) { console.error("Faltan SUPABASE_URL o SUPABASE_SERVICE_KEY"); process.exit(1); }

async function rest(path) {
  // Las claves nuevas de Supabase (sb_secret_...) van solo en "apikey"; las viejas (eyJ...) también como Bearer.
  const headers = { apikey: KEY };
  if (KEY.startsWith("eyJ")) headers.Authorization = `Bearer ${KEY}`;
  const r = await fetch(`${URL_SB}/rest/v1/${path}`, { headers });
  if (!r.ok) throw new Error(`${path}: ${r.status} ${await r.text()}`);
  return r.json();
}

// Fecha de hoy en Argentina (UTC-3)
const ahoraAR = new Date(Date.now() - 3 * 3600e3);
const hoy = ahoraAR.toISOString().slice(0, 10);

const sumarMeses = (f, n) => {
  if (!f) return null;
  const [y, m, d] = f.slice(0, 10).split("-").map(Number);
  const ult = new Date(Date.UTC(y, m - 1 + n + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m - 1 + n, Math.min(d, ult))).toISOString().slice(0, 10);
};
const dias = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);
const fmt = f => f ? f.slice(0, 10).split("-").reverse().join("/") : "—";
const esc = s => String(s ?? "").replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

const [exts, ubics, vehs, perfiles] = await Promise.all([
  rest("extintores?select=*&estado=eq.Activo"),
  rest("ubicaciones?select=id,nombre"),
  rest("vehiculos?select=id,patente,tipo"),
  rest("perfiles?select=email,nombre&rol=eq.seguridad&activo=eq.true&recibe_alarmas=eq.true")
]);
const donde = e => {
  if (e.vehiculo_id) { const v = vehs.find(x => x.id === e.vehiculo_id); return v ? `${v.tipo} ${v.patente}` : "Vehículo"; }
  const u = ubics.find(x => x.id === e.ubicacion_id); return u ? u.nombre : "—";
};

const previos = [], hoyVencen = [];
for (const e of exts) {
  const venc = [
    ["Carga", sumarMeses(e.ultima_recarga, e.meses_recarga || 12)],
    ["Prueba hidráulica", sumarMeses(e.ultima_ph, e.meses_ph || 60)]
  ].filter(x => x[1]).map(([que, f]) => ({ que, f, d: dias(hoy, f) }));
  for (const v of venc) {
    if (v.d === AVISO) previos.push({ e, ...v });   // primer aviso: faltan 5 días
    if (v.d === 0) hoyVencen.push({ e, ...v });     // recordatorio: vence hoy
  }
}

if (!previos.length && !hoyVencen.length) { console.log(`${hoy}: sin alarmas para enviar.`); process.exit(0); }
if (!perfiles.length) { console.log("No hay usuarios de Seguridad que reciban alarmas."); process.exit(0); }

const tabla = (titulo, color, filas, cols) => !filas.length ? "" : `
  <h3 style="color:${color};margin:22px 0 8px;font-family:Arial">${titulo} (${filas.length})</h3>
  <table cellpadding="6" style="border-collapse:collapse;font-family:Arial;font-size:14px;width:100%">
  <tr style="background:#f1f1f1">${cols.map(c => `<th align="left">${c[0]}</th>`).join("")}</tr>
  ${filas.map(f => `<tr style="border-bottom:1px solid #ddd">${cols.map(c => `<td>${esc(c[1](f))}</td>`).join("")}</tr>`).join("")}
  </table>`;
const cols = [["Código", f => f.e.codigo], ["Ubicación", f => donde(f.e)], ["Sector", f => f.e.sector || ""], ["Qué vence", f => f.que], ["Fecha", f => fmt(f.f)]];

const html = `<div style="max-width:720px">
  <h2 style="font-family:Arial;color:#c8211b">Alarmas de extintores — ${fmt(hoy)}</h2>
  ${tabla("Vencen HOY", "#c8211b", hoyVencen, cols)}
  ${tabla(`Vencen en ${AVISO} días`, "#b97600", previos, cols)}
  <p style="font-family:Arial;font-size:13px;color:#666;margin-top:24px">Cada vencimiento se avisa dos veces: ${AVISO} días antes y el día en que vence. El estado completo está siempre en la app.
  ${APP ? `<br><a href="${APP}">Abrir la app</a>` : ""}</p></div>`;

const partes = [];
if (hoyVencen.length) partes.push(`${hoyVencen.length} vence${hoyVencen.length === 1 ? "" : "n"} hoy`);
if (previos.length) partes.push(`${previos.length} vence${previos.length === 1 ? "" : "n"} en ${AVISO} días`);
const asunto = `[Extintores] ${partes.join(" · ")}`;
if (!env.SMTP_USER || !env.SMTP_PASS) { console.error("Faltan los secrets SMTP_USER o SMTP_PASS"); process.exit(1); }
const tx = nodemailer.createTransport({
  host: env.SMTP_HOST || "smtp.gmail.com",
  port: Number(env.SMTP_PORT || 465),
  secure: Number(env.SMTP_PORT || 465) === 465,
  auth: { user: env.SMTP_USER, pass: env.SMTP_PASS }
});
await tx.sendMail({ from: env.MAIL_FROM || `Control de Extintores <${env.SMTP_USER}>`, to: perfiles.map(p => p.email).join(","), subject: asunto, html });
console.log(`${hoy}: mail enviado a ${perfiles.length} destinatario(s). ${asunto}`);
