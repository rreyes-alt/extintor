// =====================================================================
// Alarmas diarias por mail — lo ejecuta GitHub Actions todos los días.
//   • Vencidos y observados: aviso TODOS los días hasta que se actualicen.
//   • Próximos a vencer (≤ 30 días) e inspecciones atrasadas: aviso los
//     lunes, y además el día en que un extintor entra en los 30 días.
// Variables (GitHub > Settings > Secrets and variables > Actions):
//   SUPABASE_URL, SUPABASE_SERVICE_KEY, SMTP_HOST, SMTP_PORT, SMTP_USER,
//   SMTP_PASS, MAIL_FROM (opcional), APP_URL (opcional), DIAS_AVISO (opc.)
// =====================================================================
import nodemailer from "nodemailer";

const env = process.env;
const URL_SB = (env.SUPABASE_URL || "").replace(/\/$/, "");
const KEY = env.SUPABASE_SERVICE_KEY;
const AVISO = Number(env.DIAS_AVISO || 30);
const APP = env.APP_URL || "";
if (!URL_SB || !KEY) { console.error("Faltan SUPABASE_URL o SUPABASE_SERVICE_KEY"); process.exit(1); }

async function rest(path) {
  const r = await fetch(`${URL_SB}/rest/v1/${path}`, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } });
  if (!r.ok) throw new Error(`${path}: ${r.status} ${await r.text()}`);
  return r.json();
}

// Fecha de hoy en Argentina (UTC-3)
const ahoraAR = new Date(Date.now() - 3 * 3600e3);
const hoy = ahoraAR.toISOString().slice(0, 10);
const esLunes = ahoraAR.getUTCDay() === 1;

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

const vencidos = [], observados = [], proximos = [], nuevosProx = [], atrasados = [];
for (const e of exts) {
  const venc = [
    ["Carga", sumarMeses(e.ultima_recarga, e.meses_recarga || 12)],
    ["PH", sumarMeses(e.ultima_ph, e.meses_ph || 60)]
  ].filter(x => x[1]).map(([que, f]) => ({ que, f, d: dias(hoy, f) }));
  for (const v of venc) {
    const fila = { e, ...v };
    if (v.d < 0) vencidos.push(fila);
    else if (v.d <= AVISO) { proximos.push(fila); if (v.d === AVISO) nuevosProx.push(fila); }
  }
  if (e.observado) observados.push({ e });
  const desde = e.ultima_inspeccion ? dias(e.ultima_inspeccion.slice(0, 10), hoy) : null;
  if (desde === null || desde > (e.frecuencia_dias || 30)) atrasados.push({ e, desde });
}

const incluirSemanal = esLunes;
const listaProx = incluirSemanal ? proximos : nuevosProx;
const listaAtr = incluirSemanal ? atrasados : [];
if (!vencidos.length && !observados.length && !listaProx.length && !listaAtr.length) {
  console.log(`${hoy}: sin alarmas para enviar.`); process.exit(0);
}
if (!perfiles.length) { console.log("No hay usuarios de Seguridad que reciban alarmas."); process.exit(0); }

const tabla = (titulo, color, filas, cols) => !filas.length ? "" : `
  <h3 style="color:${color};margin:22px 0 8px;font-family:Arial">${titulo} (${filas.length})</h3>
  <table cellpadding="6" style="border-collapse:collapse;font-family:Arial;font-size:14px;width:100%">
  <tr style="background:#f1f1f1">${cols.map(c => `<th align="left">${c[0]}</th>`).join("")}</tr>
  ${filas.map(f => `<tr style="border-bottom:1px solid #ddd">${cols.map(c => `<td>${esc(c[1](f))}</td>`).join("")}</tr>`).join("")}
  </table>`;

const html = `<div style="max-width:720px">
  <h2 style="font-family:Arial;color:#c8211b">Alarmas de extintores — ${fmt(hoy)}</h2>
  ${tabla("Vencidos", "#c8211b", vencidos.sort((a, b) => a.d - b.d), [["Código", f => f.e.codigo], ["Ubicación", f => donde(f.e)], ["Qué", f => f.que], ["Venció", f => fmt(f.f)], ["Hace", f => `${-f.d} días`]])}
  ${tabla("Observados en la última inspección", "#c8211b", observados, [["Código", f => f.e.codigo], ["Ubicación", f => donde(f.e)], ["Sector", f => f.e.sector || ""]])}
  ${tabla(incluirSemanal ? `Vencen en los próximos ${AVISO} días` : `Entraron en el aviso de ${AVISO} días`, "#b97600", listaProx.sort((a, b) => a.d - b.d), [["Código", f => f.e.codigo], ["Ubicación", f => donde(f.e)], ["Qué", f => f.que], ["Vence", f => fmt(f.f)], ["Faltan", f => `${f.d} días`]])}
  ${tabla("Inspección atrasada", "#b97600", listaAtr, [["Código", f => f.e.codigo], ["Ubicación", f => donde(f.e)], ["Última", f => f.desde === null ? "Nunca" : `hace ${f.desde} días`]])}
  <p style="font-family:Arial;font-size:13px;color:#666;margin-top:24px">Este aviso se repite hasta que se cargue la nueva fecha de recarga/PH, una inspección nueva o se resuelva la observación.
  ${APP ? `<br><a href="${APP}">Abrir la app</a>` : ""}</p></div>`;

const asunto = `[Extintores] ${vencidos.length} vencidos · ${observados.length} observados · ${proximos.length} por vencer`;
const tx = nodemailer.createTransport({
  host: env.SMTP_HOST || "smtp.gmail.com",
  port: Number(env.SMTP_PORT || 465),
  secure: Number(env.SMTP_PORT || 465) === 465,
  auth: { user: env.SMTP_USER, pass: env.SMTP_PASS }
});
await tx.sendMail({ from: env.MAIL_FROM || env.SMTP_USER, to: perfiles.map(p => p.email).join(","), subject: asunto, html });
console.log(`${hoy}: mail enviado a ${perfiles.length} destinatario(s). ${asunto}`);
