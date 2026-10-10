/* =====================================================================
   app.js — Pantallas de la app de Control de Extintores
   ===================================================================== */
(function () {
  "use strict";
  const S = window.Store;
  const CFG = window.APP_CONFIG || {};

  /* ---------------- utilidades de interfaz ---------------- */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fecha = s => { if (!s) return "—"; const [y, m, d] = s.slice(0, 10).split("-"); return `${d}/${m}/${y}`; };
  const fechaHora = iso => {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" }) + " " +
      d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
  };
  const hora = iso => iso ? new Date(iso).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }) : "";

  const IC = {
    home: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>',
    lista: '<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>',
    nfc: '<path d="M6 8.5a6 6 0 0 1 0 7"/><path d="M9.5 6a10 10 0 0 1 0 12"/><path d="M13 3.5a14 14 0 0 1 0 17"/><circle cx="3" cy="12" r="1"/>',
    mapa: '<path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2z"/><path d="M9 4v14M15 6v14"/>',
    mas: '<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>',
    mas2: '<path d="M12 5v14M5 12h14"/>',
    atras: '<path d="M15 18l-6-6 6-6"/>',
    camara: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
    alerta: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.5"/>',
    ok: '<path d="M5 12l5 5 9-10"/>',
    ext: '<path d="M10 7h4v14h-4z"/><path d="M12 7V4h4"/><path d="M8 4h4"/><path d="M14 9h3l2 3"/>',
    descarga: '<path d="M12 4v11M7 10l5 5 5-5M4 20h16"/>',
    usuarios: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6"/>',
    pin: '<path d="M12 21s-7-6.5-7-12a7 7 0 0 1 14 0c0 5.5-7 12-7 12z"/><circle cx="12" cy="9" r="2.5"/>',
    camion: '<path d="M2 6h12v10H2zM14 10h4l3 3v3h-7"/><circle cx="6" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>',
    chk: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="M3 6l1.5 1.5L7 5M3 12l1.5 1.5L7 11M3 18l1.5 1.5L7 17"/>',
    sync: '<path d="M20 11a8 8 0 0 0-14-5L4 8M4 13a8 8 0 0 0 14 5l2-2"/><path d="M4 3v5h5M20 21v-5h-5"/>',
    llave: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3"/>',
    salir: '<path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10"/>',
    baja: '<circle cx="12" cy="12" r="9"/><path d="M8 12h8"/>',
    doc: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/>',
    clip: '<path d="M20 11l-8.5 8.5a5 5 0 0 1-7-7L13 4a3.5 3.5 0 0 1 5 5l-8.5 8.5a2 2 0 0 1-3-3L14 7"/>'
  };
  const ic = (n, extra = "") => `<svg class="ic" viewBox="0 0 24 24" ${extra}>${IC[n] || ""}</svg>`;

  function toast(msg, ms = 2600) {
    const t = $("#toast");
    t.textContent = msg; t.classList.add("ver");
    clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove("ver"), ms);
  }

  function modal({ titulo, cuerpo, acciones = [], alAbrir }) {
    const fondo = document.createElement("div");
    fondo.className = "modal-fondo";
    fondo.innerHTML = `<div class="modal" role="dialog" aria-modal="true"><h2>${esc(titulo)}</h2><div class="cuerpo">${cuerpo || ""}</div>
      <div class="pie">${acciones.map((a, i) => `<button class="btn ${a.clase || ""}" data-i="${i}" type="button">${esc(a.txt)}</button>`).join("")}</div></div>`;
    const cerrar = () => { fondo.remove(); window.removeEventListener("hashchange", cerrar); };
    fondo.addEventListener("click", e => { if (e.target === fondo) cerrar(); });
    $$(".pie button", fondo).forEach(b => b.addEventListener("click", async () => {
      const a = acciones[+b.dataset.i];
      if (!a.fn) return cerrar();
      b.disabled = true;
      try { const r = await a.fn(fondo); if (r !== false) cerrar(); }
      catch (e) { toast(e.message || String(e), 4000); }
      finally { b.disabled = false; }
    }));
    document.body.appendChild(fondo);
    window.addEventListener("hashchange", cerrar);
    if (alAbrir) alAbrir(fondo, cerrar);
    return { el: fondo, cerrar };
  }
  const confirmar = (titulo, texto, txtOk = "Confirmar") => new Promise(res => {
    modal({ titulo, cuerpo: `<p>${esc(texto)}</p>`, acciones: [{ txt: "Cancelar", fn: () => res(false) }, { txt: txtOk, clase: "prim", fn: () => res(true) }] });
  });
  const datosForm = form => Object.fromEntries(new FormData(form).entries());
  const hayModal = () => !!$(".modal-fondo");

  /* ---------------- tipos de ubicación ---------------- */
  const TIPOS_FIJOS = ["Base", "Taller", "Campo"];          // ubicaciones con lugar fijo (van al mapa)
  const TIPOS_UBIC = [...TIPOS_FIJOS, "Pickup", "Trailer"];  // todos los tipos de un extintor

  /* ---------------- datos en memoria ---------------- */
  const D = { ubicaciones: [], vehiculos: [], extintores: [], checklist_items: [], perfiles: [], inspecciones: [], documentos: [] };
  async function cargar() {
    const [u, v, e, c, p, i, dc] = await Promise.all(["ubicaciones", "vehiculos", "extintores", "checklist_items", "perfiles", "inspecciones", "documentos"].map(t => S.all(t)));
    D.documentos = dc.sort((a, b) => (b.fecha || b.created_at || "").localeCompare(a.fecha || a.created_at || ""));
    D.ubicaciones = u.sort((a, b) => a.nombre.localeCompare(b.nombre));
    D.vehiculos = v.sort((a, b) => a.patente.localeCompare(b.patente));
    D.extintores = e.sort((a, b) => a.codigo.localeCompare(b.codigo, "es", { numeric: true }));
    D.checklist_items = c.sort((a, b) => (a.orden || 0) - (b.orden || 0));
    D.perfiles = p.sort((a, b) => (a.nombre || "").localeCompare(b.nombre || ""));
    D.inspecciones = i.sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));
  }
  const ubic = id => D.ubicaciones.find(u => u.id === id);
  const veh = id => D.vehiculos.find(v => v.id === id);
  function dondeEsta(ext) {
    if (ext.tipo_ubicacion === "Pickup" || ext.tipo_ubicacion === "Trailer") {
      const v = veh(ext.vehiculo_id);
      return v ? `${ext.tipo_ubicacion} ${v.patente}` : ext.tipo_ubicacion || "—";
    }
    const u = ubic(ext.ubicacion_id);
    return u ? u.nombre : (ext.tipo_ubicacion || "—");
  }

  function etiquetas(ext, c) {
    c = c || S.calcular(ext);
    const t = [];
    if (!c.activo) t.push(`<span class="badge b-gris">${esc(ext.estado)}</span>`);
    if (c.venc === "vencido") t.push(`<span class="badge b-rojo">Vencido</span>`);
    if (c.observado) t.push(`<span class="badge b-rojo">Observado</span>`);
    if (c.activo && c.venc === "proximo") t.push(`<span class="badge b-amarillo">Vence en ${c.dias} d</span>`);
    if (c.activo && c.atrasada) t.push(`<span class="badge b-amarillo">Inspección atrasada</span>`);
    if (c.venc === "sin_datos") t.push(`<span class="badge b-gris">Sin fechas</span>`);
    if (c.activo && c.nivel === "verde") t.push(`<span class="badge b-verde">En regla</span>`);
    if (!ext.nfc_uid) t.push(`<span class="badge b-azul">Sin NFC</span>`);
    return t.join("");
  }

  function itemExtintor(ext) {
    const c = S.calcular(ext);
    return `<a class="ext-item" href="#/extintor/${ext.id}">
      <div class="barra ${c.nivel}"></div>
      <div class="grow">
        <div class="row"><div class="cod grow">${esc(ext.codigo)}</div><div class="muted small">${esc(ext.agente || "")} ${ext.capacidad_kg ? esc(ext.capacidad_kg) + " kg" : ""}</div></div>
        <div class="det">${esc(dondeEsta(ext))}${ext.sector ? " · " + esc(ext.sector) : ""}</div>
        <div class="tags">${etiquetas(ext, c)}</div>
      </div></a>`;
  }

  /* ---------------- fotos y GPS ---------------- */
  async function comprimir(file, max = 1280, calidad = 0.72) {
    const img = await new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => res(i); i.onerror = rej;
      i.src = URL.createObjectURL(file);
    });
    const k = Math.min(1, max / Math.max(img.width, img.height));
    const cv = document.createElement("canvas");
    cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
    cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
    URL.revokeObjectURL(img.src);
    return new Promise(res => cv.toBlob(res, "image/jpeg", calidad));
  }
  function gps(timeout = 9000) {
    return new Promise(res => {
      if (!navigator.geolocation) return res(null);
      navigator.geolocation.getCurrentPosition(
        p => res({ lat: p.coords.latitude, lng: p.coords.longitude, prec: p.coords.accuracy }),
        () => res(null), { enableHighAccuracy: true, timeout, maximumAge: 60000 });
    });
  }

  /* ---------------- NFC ---------------- */
  const nfcDisponible = () => "NDEFReader" in window;
  function leerNFC(titulo = "Escanear etiqueta") {
    return new Promise((resolve) => {
      if (!nfcDisponible()) {
        modal({
          titulo: "NFC no disponible",
          cuerpo: `<p>Este navegador no puede leer etiquetas NFC. Usá <b>Chrome en un celular Android</b> con el NFC activado.</p>
                   <p class="muted small">Mientras tanto podés buscar el extintor por código desde la lista.</p>`,
          acciones: [{ txt: "Entendido", clase: "prim", fn: () => resolve(null) }]
        });
        return;
      }
      const ctrl = new AbortController();
      let terminado = false;
      const m = modal({
        titulo,
        cuerpo: `<div class="nfc-anim">${ic("nfc")}</div><p class="center"><b>Acercá la parte de atrás del celular a la etiqueta del extintor.</b></p><p class="center muted small" id="nfc-msg">Esperando lectura…</p>`,
        acciones: [{ txt: "Cancelar", fn: () => { terminado = true; ctrl.abort(); resolve(null); } }]
      });
      const reader = new window.NDEFReader();
      reader.scan({ signal: ctrl.signal }).then(() => {
        reader.onreading = ev => {
          if (terminado) return;
          terminado = true; ctrl.abort(); m.cerrar();
          if (navigator.vibrate) navigator.vibrate(80);
          resolve((ev.serialNumber || "").toUpperCase());
        };
        reader.onreadingerror = () => { const x = $("#nfc-msg"); if (x) x.textContent = "No se pudo leer. Probá moviendo el celular despacio."; };
      }).catch(err => {
        terminado = true; m.cerrar();
        toast(err.name === "NotAllowedError" ? "Permiso de NFC denegado" : "No se pudo iniciar NFC: " + err.message, 4000);
        resolve(null);
      });
    });
  }

  async function escanear() {
    const uid = await leerNFC();
    if (!uid) return;
    const ext = D.extintores.find(e => (e.nfc_uid || "").toUpperCase() === uid);
    if (ext && ext.estado === "Baja") { toast(`${ext.codigo} está dado de baja`, 3500); location.hash = `#/extintor/${ext.id}`; return; }
    if (ext) { location.hash = `#/inspeccion/${ext.id}?nfc=1`; return; }
    if (!S.esSeguridad()) {
      modal({ titulo: "Etiqueta sin vincular", cuerpo: `<p>La etiqueta <span class="mono">${esc(uid)}</span> no está asociada a ningún extintor. Avisale a Seguridad.</p>`, acciones: [{ txt: "Cerrar", clase: "prim" }] });
      return;
    }
    const libres = D.extintores.filter(e => !e.nfc_uid && e.estado !== "Baja");
    modal({
      titulo: "Etiqueta sin vincular",
      cuerpo: `<p>La etiqueta <span class="mono">${esc(uid)}</span> no está asociada. ¿A qué extintor pertenece?</p>
        ${libres.length ? `<label class="campo"><span>Extintor sin etiqueta</span><select id="vinc-sel">${libres.map(e => `<option value="${e.id}">${esc(e.codigo)} — ${esc(dondeEsta(e))}</option>`).join("")}</select></label>` : `<p class="muted">No hay extintores sin etiqueta.</p>`}`,
      acciones: [
        { txt: "Nuevo extintor", fn: () => { sessionStorage.setItem("nfcNuevo", uid); location.hash = "#/editar/nuevo"; } },
        ...(libres.length ? [{ txt: "Vincular", clase: "prim", fn: async el => { const id = $("#vinc-sel", el).value; await S.update("extintores", id, { nfc_uid: uid }); toast("Etiqueta vinculada"); location.hash = `#/extintor/${id}`; } }] : [])
      ]
    });
  }

  /* ---------------- estructura de pantalla ---------------- */
  function marco({ titulo, atras, cuerpo, nav = true, fab }) {
    const r = ruta();
    const tab = r.p[0] || "inicio";
    $("#app").innerHTML = `
      <header class="topbar">
        ${atras ? `<button class="atras" id="btn-atras" aria-label="Volver">${ic("atras")}</button>` : ""}
        <div class="titulo">${esc(titulo)}</div>
        <button class="pill-sync" id="pill-sync"></button>
      </header>
      <main id="vista">${cuerpo}</main>
      ${fab ? `<button class="fab" id="fab" aria-label="${esc(fab.label)}">${ic(fab.icono || "mas2")}</button>` : ""}
      ${nav ? `<nav class="abajo">
        <a href="#/inicio" class="${tab === "inicio" ? "activo" : ""}">${ic("home")}Inicio</a>
        <a href="#/extintores" class="${tab === "extintores" ? "activo" : ""}">${ic("lista")}Extintores</a>
        <a href="#/escanear" class="scan" aria-label="Escanear NFC"><span class="circ">${ic("nfc")}</span></a>
        <a href="#/mapa" class="${tab === "mapa" ? "activo" : ""}">${ic("mapa")}Mapa</a>
        <a href="#/mas" class="${["mas", "admin", "exportar"].includes(tab) ? "activo" : ""}">${ic("mas")}Más</a>
      </nav>` : ""}`;
    if (atras) $("#btn-atras").onclick = () => (history.length > 1 ? history.back() : (location.hash = atras));
    if (fab) $("#fab").onclick = fab.fn;
    pintarSync();
    window.scrollTo(0, 0);
  }

  function pintarSync() {
    const b = $("#pill-sync");
    if (!b) return;
    const e = S.estado;
    let cls = "", txt;
    if (S.DEMO) { txt = "Modo demo"; cls = "off"; }
    else if (e.sincronizando) { txt = "Sincronizando…"; cls = "sync"; }
    else if (!navigator.onLine) { txt = e.pendientes ? `Sin señal · ${e.pendientes} pend.` : "Sin señal"; cls = "off"; }
    else if (e.errores) { txt = `${e.errores} con error`; cls = "err"; }
    else if (e.pendientes) { txt = `${e.pendientes} pendientes`; cls = "off"; }
    else if (e.mensaje) { txt = e.mensaje; cls = "err"; }
    else txt = e.ultimaSync ? `Al día · ${hora(e.ultimaSync)}` : "Conectado";
    b.className = "pill-sync " + cls;
    b.innerHTML = `<span class="dot"></span>${esc(txt)}`;
    b.onclick = () => { location.hash = "#/mas"; };
  }

  /* ---------------- router ---------------- */
  function ruta() {
    const h = (location.hash || "#/inicio").slice(2);
    const [path, qs] = h.split("?");
    return { p: path.split("/").filter(Boolean), q: new URLSearchParams(qs || "") };
  }
  let vistaViva = false;
  async function render() {
    vistaViva = false;
    if (!S.perfil) return pantallaLogin();
    await cargar();
    const r = ruta();
    const [a, b] = r.p;
    const soloSeg = () => { if (!S.esSeguridad()) { location.hash = "#/inicio"; return true; } return false; };
    switch (a) {
      case undefined: case "inicio": return pantallaInicio();
      case "extintores": return pantallaLista(r.q);
      case "extintor": return pantallaFicha(b);
      case "editar": if (soloSeg()) return; return pantallaEditar(b);
      case "inspeccion": return pantallaInspeccion(b, r.q.get("nfc") === "1");
      case "escanear": history.replaceState(null, "", "#/inicio"); await pantallaInicio(); return escanear();
      case "mapa": return pantallaMapa();
      case "mas": return pantallaMas();
      case "admin": if (soloSeg()) return; return pantallaAdmin(b);
      case "exportar": if (soloSeg()) return; return pantallaExportar();
      default: location.hash = "#/inicio";
    }
  }

  /* ================= LOGIN ================= */
  function pantallaLogin() {
    const demo = S.DEMO;
    $("#app").innerHTML = `<div class="login">
      <div class="logo"><img src="icons/icon-192.png" alt=""></div>
      <h1>${esc(CFG.EMPRESA || "Control de Extintores")}</h1>
      <p class="muted">Trazabilidad, inspecciones y vencimientos.</p>
      ${demo ? `
        <div class="alerta azul" style="margin:14px 0">Modo demo: los datos son de ejemplo y quedan solo en este dispositivo.</div>
        <div class="stack">
          <button class="btn prim full" id="d-seg">Entrar como Seguridad</button>
          <button class="btn full" id="d-op">Entrar como Operador</button>
        </div>` : `
        <form id="f-login" class="stack" style="margin-top:18px">
          <label class="campo"><span>Mail</span><input type="email" name="email" autocomplete="username" required></label>
          <label class="campo"><span>Contraseña</span><input type="password" name="clave" autocomplete="current-password" required></label>
          <div class="error" id="l-err"></div>
          <button class="btn prim full" type="submit">Ingresar</button>
          <button class="btn full" type="button" id="l-olvide">Olvidé mi contraseña</button>
        </form>`}
    </div>`;
    if (demo) {
      $("#d-seg").onclick = async () => { await S.loginDemo("seguridad"); await cargar(); location.hash = "#/inicio"; render(); };
      $("#d-op").onclick = async () => { await S.loginDemo("operador"); await cargar(); location.hash = "#/inicio"; render(); };
      return;
    }
    $("#f-login").onsubmit = async ev => {
      ev.preventDefault();
      const f = datosForm(ev.target);
      const btn = $("button[type=submit]", ev.target);
      btn.disabled = true; btn.textContent = "Ingresando…"; $("#l-err").textContent = "";
      try {
        if (!navigator.onLine) throw new Error("El primer ingreso necesita conexión.");
        await S.login(f.email, f.clave);
        await cargar(); location.hash = "#/inicio"; render();
      } catch (e) { $("#l-err").textContent = e.message || String(e); }
      finally { btn.disabled = false; btn.textContent = "Ingresar"; }
    };
    $("#l-olvide").onclick = () => modal({
      titulo: "Recuperar contraseña",
      cuerpo: `<label class="campo"><span>Mail</span><input type="email" id="rec-mail"></label><p class="muted small">Te llega un mail con un link para crear una nueva contraseña.</p>`,
      acciones: [{ txt: "Cancelar" }, { txt: "Enviar", clase: "prim", fn: async el => { await S.recuperarClave($("#rec-mail", el).value); toast("Mail enviado"); } }]
    });
  }

  /* ================= INICIO ================= */
  async function pantallaInicio() {
    const act = D.extintores.filter(e => e.estado !== "Baja");
    const calc = act.map(e => ({ e, c: S.calcular(e) }));
    const n = {
      vencidos: calc.filter(x => x.c.activo && x.c.venc === "vencido").length,
      observados: calc.filter(x => x.c.activo && x.c.observado).length,
      proximos: calc.filter(x => x.c.activo && x.c.venc === "proximo").length,
      atrasados: calc.filter(x => x.c.activo && x.c.atrasada).length,
      enregla: calc.filter(x => x.c.nivel === "verde").length,
      total: act.length
    };
    const peso = x => (x.c.venc === "vencido" ? 0 : x.c.observado ? 1 : x.c.venc === "proximo" ? 2 : x.c.atrasada ? 3 : 4);
    const atencion = calc.filter(x => x.c.activo && x.c.nivel !== "verde").sort((a, b) => peso(a) - peso(b) || (a.c.dias ?? 9e9) - (b.c.dias ?? 9e9)).slice(0, 25);
    const nombre = (S.perfil.nombre || "").split(" ")[0];
    marco({
      titulo: CFG.EMPRESA || "Control de Extintores",
      cuerpo: `
        <p class="muted" style="margin:0 0 12px">Hola${nombre ? ", " + esc(nombre) : ""} · ${S.esSeguridad() ? "Seguridad" : "Operador"}</p>
        <button class="btn-escanear" id="b-scan">${ic("nfc")} Escanear extintor</button>
        <div class="seccion">Estado general · ${n.total} extintores</div>
        <div class="kpis">
          <a class="kpi rojo" href="#/extintores?f=vencidos"><div class="n">${n.vencidos}</div><div class="t">Vencidos</div></a>
          <a class="kpi rojo" href="#/extintores?f=observados"><div class="n">${n.observados}</div><div class="t">Observados</div></a>
          <a class="kpi amarillo" href="#/extintores?f=proximos"><div class="n">${n.proximos}</div><div class="t">Vencen en ${CFG.DIAS_AVISO || 30} días</div></a>
          <a class="kpi amarillo" href="#/extintores?f=atrasados"><div class="n">${n.atrasados}</div><div class="t">Inspección atrasada</div></a>
        </div>
        <div class="seccion">Requieren atención</div>
        ${atencion.length ? atencion.map(x => itemExtintor(x.e)).join("") :
          `<div class="card center"><div class="alerta verde" style="justify-content:center">${ic("ok")} Todo en regla</div></div>`}`
    });
    $("#b-scan").onclick = escanear;
    vistaViva = true;
  }

  /* ================= LISTA ================= */
  const FILTROS = [
    ["todos", "Todos"], ["vencidos", "Vencidos"], ["observados", "Observados"], ["proximos", "Próximos"],
    ["atrasados", "Atrasados"], ["sinnfc", "Sin NFC"], ["baja", "Dados de baja"]
  ];
  function pantallaLista(q) {
    const f = q.get("f") || "todos";
    const u = q.get("ubic") || "", vh = q.get("veh") || "", tipo = q.get("tipo") || "";
    const texto = (sessionStorage.getItem("busqueda") || "").toLowerCase();
    let lista = D.extintores.filter(e => f === "baja" ? e.estado === "Baja" : e.estado !== "Baja");
    if (u) lista = lista.filter(e => e.ubicacion_id === u);
    if (vh) lista = lista.filter(e => e.vehiculo_id === vh);
    if (tipo) lista = lista.filter(e => e.tipo_ubicacion === tipo);
    lista = lista.filter(e => {
      const c = S.calcular(e);
      if (f === "vencidos") return c.activo && c.venc === "vencido";
      if (f === "observados") return c.activo && c.observado;
      if (f === "proximos") return c.activo && c.venc === "proximo";
      if (f === "atrasados") return c.activo && c.atrasada;
      if (f === "sinnfc") return !e.nfc_uid;
      return true;
    });
    const extra = u ? (ubic(u) || {}).nombre : vh ? (veh(vh) || {}).patente : "";
    const qs = (k, v) => { const n = new URLSearchParams(q); v ? n.set(k, v) : n.delete(k); return "#/extintores?" + n.toString(); };
    marco({
      titulo: "Extintores",
      fab: S.esSeguridad() ? { label: "Nuevo extintor", fn: () => { location.hash = "#/editar/nuevo"; } } : null,
      cuerpo: `
        <input type="search" id="buscar" placeholder="Buscar por código, serie, patente, sector…" value="${esc(sessionStorage.getItem("busqueda") || "")}">
        <div class="chips" style="margin-top:10px">${FILTROS.map(([k, t]) => `<a class="chip ${f === k ? "on" : ""}" href="${qs("f", k === "todos" ? "" : k)}">${t}</a>`).join("")}</div>
        <div class="row" style="margin:4px 0 10px">
          <select id="sel-tipo" class="grow" style="min-height:42px">
            <option value="">Todas las ubicaciones</option>
            ${TIPOS_UBIC.map(t => `<option ${tipo === t ? "selected" : ""}>${t}</option>`).join("")}
          </select>
        </div>
        ${extra ? `<div class="alerta azul" style="margin-bottom:10px"><span class="grow">Filtrado por: ${esc(extra)}</span><a href="${qs(u ? "ubic" : "veh", "")}">Quitar</a></div>` : ""}
        <div class="muted small" id="cuenta"></div>
        <div id="res" style="margin-top:8px"></div>`
    });
    const pintar = (txt) => {
      const v = (txt || "").toLowerCase();
      const r = !v ? lista : lista.filter(e => [e.codigo, e.serie, e.agente, e.marca, e.sector, dondeEsta(e), e.nfc_uid].join(" ").toLowerCase().includes(v));
      $("#cuenta").textContent = `${r.length} extintor${r.length === 1 ? "" : "es"}`;
      $("#res").innerHTML = r.length ? r.map(itemExtintor).join("") : `<div class="vacio">No hay extintores con este filtro.</div>`;
    };
    $("#buscar").addEventListener("input", ev => { sessionStorage.setItem("busqueda", ev.target.value); pintar(ev.target.value); });
    $("#sel-tipo").onchange = ev => { location.hash = qs("tipo", ev.target.value); };
    pintar(texto);
    vistaViva = true;
  }

  /* ================= FICHA ================= */
  function pantallaFicha(id) {
    const e = D.extintores.find(x => x.id === id);
    if (!e) { marco({ titulo: "Extintor", atras: "#/extintores", cuerpo: `<div class="vacio">No se encontró el extintor.</div>` }); return; }
    const c = S.calcular(e);
    const seg = S.esSeguridad();
    const hist = D.inspecciones.filter(i => i.extintor_id === id);
    const docs = D.documentos.filter(d => d.extintor_id === id);
    const alertas = [];
    const dtxt = d => d < 0 ? `venció hace ${-d} día${d === -1 ? "" : "s"}` : d === 0 ? "vence hoy" : `vence en ${d} día${d === 1 ? "" : "s"}`;
    const aviso = Number(CFG.DIAS_AVISO || 30);
    const deBaja = e.estado === "Baja";
    if (deBaja) alertas.push(["rojo", `Dado de baja${e.fecha_baja ? " el " + fecha(e.fecha_baja) : ""}${e.motivo_baja ? " · " + e.motivo_baja : ""}. No genera alarmas.`]);
    else if (!c.activo) alertas.push(["azul", `Estado: ${e.estado}. No genera alarmas.`]);
    if (!deBaja && c.dCarga !== null && c.dCarga <= aviso) alertas.push([c.dCarga < 0 ? "rojo" : "amarillo", `Carga: ${dtxt(c.dCarga)} (${fecha(c.vencCarga)})`]);
    if (!deBaja && c.dPh !== null && c.dPh <= aviso) alertas.push([c.dPh < 0 ? "rojo" : "amarillo", `Prueba hidráulica: ${dtxt(c.dPh)} (${fecha(c.vencPh)})`]);
    if (c.observado) alertas.push(["rojo", "Observado en la última inspección"]);
    if (c.activo && c.atrasada) alertas.push(["amarillo", e.ultima_inspeccion ? `Inspección atrasada: última hace ${c.diasDesdeInsp} días` : "Nunca fue inspeccionado"]);
    if (c.venc === "sin_datos") alertas.push(["amarillo", "Faltan fechas de recarga o PH"]);
    if (!alertas.length) alertas.push(["verde", `En regla · próxima inspección en ${c.proxInsp} días`]);

    marco({
      titulo: e.codigo,
      atras: "#/extintores",
      cuerpo: `
        <div class="card">
          <div class="row"><div class="grow"><h1>${esc(e.codigo)}</h1><div class="muted">${esc(e.agente || "")} · ${esc(e.capacidad_kg || "—")} kg${e.marca ? " · " + esc(e.marca) : ""}</div></div>${ic("ext", 'style="width:36px;height:36px;color:var(--brand)"')}</div>
          <div style="margin-top:14px">${alertas.map(([k, t]) => `<div class="alerta ${k}">${ic(k === "verde" ? "ok" : "alerta")}<span>${esc(t)}</span></div>`).join("")}</div>
        </div>
        <div class="acciones" style="margin-top:12px">
          ${deBaja ? "" : `<a class="btn prim full2" href="#/inspeccion/${e.id}">${ic("chk")} Inspeccionar sin NFC</a>`}
          ${seg && deBaja ? `<button class="btn full2" id="b-reactivar">${ic("sync")} Reactivar extintor</button>` : ""}
          ${seg && !deBaja ? `
            <button class="btn" id="b-recarga">Registrar recarga</button>
            <button class="btn" id="b-ph">Registrar PH</button>
            <button class="btn" id="b-nfc">${ic("nfc")} ${e.nfc_uid ? "Cambiar NFC" : "Vincular NFC"}</button>
            <a class="btn" href="#/editar/${e.id}">Editar ficha</a>
            ${c.observado ? `<button class="btn full2" id="b-resolver">${ic("ok")} Marcar observación resuelta</button>` : ""}
            <button class="btn peligro full2" id="b-baja">${ic("baja")} Dar de baja</button>` : ""}
        </div>
        <div class="seccion">Ficha técnica</div>
        <div class="card datos">
          <div><div class="k">N° de serie</div><div class="v">${esc(e.serie || "—")}</div></div>
          <div><div class="k">Fabricación</div><div class="v">${fecha(e.fecha_fabricacion)}</div></div>
          <div><div class="k">Última recarga</div><div class="v">${fecha(e.ultima_recarga)}</div></div>
          <div><div class="k">Vence carga</div><div class="v">${fecha(c.vencCarga)}</div></div>
          <div><div class="k">Última PH</div><div class="v">${fecha(e.ultima_ph)}</div></div>
          <div><div class="k">Vence PH</div><div class="v">${fecha(c.vencPh)}</div></div>
          <div><div class="k">Ubicación</div><div class="v">${esc(dondeEsta(e))}</div></div>
          <div><div class="k">Sector</div><div class="v">${esc(e.sector || "—")}</div></div>
          <div><div class="k">Inspección</div><div class="v">${e.frecuencia_dias == 15 ? "Quincenal" : "Mensual"}</div></div>
          <div><div class="k">Estado</div><div class="v">${esc(e.estado || "Activo")}</div></div>
          <div><div class="k">Etiqueta NFC</div><div class="v mono">${esc(e.nfc_uid || "Sin vincular")}</div></div>
          <div><div class="k">Última inspección</div><div class="v">${fechaHora(e.ultima_inspeccion)}</div></div>
          ${e.observaciones ? `<div style="grid-column:1/-1"><div class="k">Observaciones</div><div class="v">${esc(e.observaciones)}</div></div>` : ""}
        </div>
        <div class="seccion row"><span class="grow">Documentos (${docs.length})</span></div>
        <div class="card">
          ${docs.length ? `<div class="lista-simple">${docs.map(d => `<div>
            <button type="button" class="doc-abrir grow row" data-id="${d.id}" style="background:none;border:0;padding:0;text-align:left;cursor:pointer;color:inherit;min-width:0">
              <span class="doc-ic ${(d.mime || "").includes("pdf") ? "pdf" : "img"}">${(d.mime || "").includes("pdf") ? "PDF" : "JPG"}</span>
              <span class="grow" style="min-width:0"><b>${esc(d.tipo || "Documento")}</b>${d._pendiente ? ` <span class="badge b-amarillo">pendiente</span>` : ""}
                <span class="muted small" style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(d.descripcion || d.nombre || "")}</span>
                <span class="muted small">${d.fecha ? fecha(d.fecha) : fechaHora(d.created_at)} · ${tam(d.tamano)}</span></span>
            </button>
            ${seg ? `<button type="button" class="btn chico doc-borrar" data-id="${d.id}" aria-label="Eliminar documento">✕</button>` : ""}
          </div>`).join("")}</div>` : `<div class="muted">Sin documentos. Podés adjuntar la ficha técnica, certificados de recarga o PH (JPG, PNG o PDF).</div>`}
          <button type="button" class="btn full" id="b-doc" style="margin-top:12px">${ic("clip")} Adjuntar documento</button>
        </div>
        <div class="seccion">Historial de inspecciones (${hist.length})</div>
        <div class="card">${hist.length ? hist.map(i => `
          <details class="hist" data-id="${i.id}">
            <summary class="row">
              <span class="grow"><b>${fechaHora(i.fecha)}</b><br><span class="muted small">${esc(i.inspector_nombre || "")}${i.nfc_leido ? " · NFC ✓" : " · sin NFC"}${i._pendiente ? " · pendiente de subir" : ""}</span></span>
              ${i.todo_ok ? `<span class="badge b-verde">OK</span>` : `<span class="badge b-rojo">Con fallas</span>`}
            </summary>
            <div style="margin-top:10px" class="small">
              ${(i.resultados || []).filter(r => !r.ok).map(r => `<div class="error">✗ ${esc(r.texto)}</div>`).join("")}
              ${i.observaciones ? `<p>${esc(i.observaciones)}</p>` : ""}
              <div class="fotos" data-fotos='${esc(JSON.stringify(i.fotos || []))}'></div>
            </div>
          </details>`).join("") : `<div class="muted">Todavía no hay inspecciones.</div>`}</div>`
    });

    $$("details.hist").forEach(d => d.addEventListener("toggle", async () => {
      if (!d.open) return;
      const cont = $(".fotos", d);
      if (cont.dataset.cargado) return;
      cont.dataset.cargado = 1;
      const rutas = JSON.parse(cont.dataset.fotos || "[]");
      if (!rutas.length) return;
      cont.innerHTML = `<span class="muted small">Cargando fotos…</span>`;
      const urls = await Promise.all(rutas.map(r => S.urlFoto(r)));
      cont.innerHTML = urls.map(u => u ? `<a class="foto" href="${u}" target="_blank" rel="noopener"><img src="${u}" alt="Foto de inspección"></a>` : `<div class="foto center small muted" style="display:grid;place-items:center">Sin señal</div>`).join("");
    }));

    $("#b-doc").onclick = () => adjuntarDocumento(e);
    $$(".doc-abrir").forEach(b => b.onclick = () => abrirDocumento(D.documentos.find(d => d.id === b.dataset.id)));
    $$(".doc-borrar").forEach(b => b.onclick = async () => {
      const d = D.documentos.find(x => x.id === b.dataset.id);
      if (!d) return;
      if (await confirmar("Eliminar documento", `¿Eliminar "${d.tipo || "documento"}${d.nombre ? " – " + d.nombre : ""}"? No se puede deshacer.`, "Eliminar")) {
        await S.borrar("documentos", d.id, [d.ruta]); await cargar(); toast("Documento eliminado"); render();
      }
    });
    if (!seg) return;
    const pedirFecha = (titulo, campo, ayuda) => modal({
      titulo,
      cuerpo: `<label class="campo"><span>Fecha</span><input type="date" id="f-fecha" value="${S.hoyStr()}" max="${S.hoyStr()}"></label><p class="muted small">${ayuda}</p>
               ${e.estado !== "Activo" ? `<label class="check"><input type="checkbox" id="f-activo" checked> Volver a estado Activo</label>` : ""}`,
      acciones: [{ txt: "Cancelar" }, {
        txt: "Guardar", clase: "prim", fn: async el => {
          const v = $("#f-fecha", el).value;
          if (!v) throw new Error("Ingresá una fecha");
          const cambios = { [campo]: v };
          const ch = $("#f-activo", el); if (ch && ch.checked) cambios.estado = "Activo";
          await S.update("extintores", e.id, cambios); toast("Guardado");
        }
      }]
    });
    const bReac = $("#b-reactivar");
    if (bReac) {
      bReac.onclick = async () => {
        if (await confirmar("Reactivar extintor", `${e.codigo} vuelve a estado Activo y a generar alarmas. Revisá que las fechas de recarga y PH estén al día.`, "Reactivar")) {
          await S.update("extintores", e.id, { estado: "Activo", fecha_baja: null, motivo_baja: null }); toast("Extintor reactivado");
        }
      };
      vistaViva = true;
      return;
    }
    $("#b-baja").onclick = () => modal({
      titulo: `Dar de baja ${e.codigo}`,
      cuerpo: `<div class="stack">
        <p style="margin:0">El extintor deja de aparecer en las listas y no genera más alarmas. Su historial, fotos y documentos se conservan, y se puede reactivar.</p>
        <label class="campo"><span>Motivo *</span><select id="b-motivo"><option value="">Elegir…</option>${MOTIVOS_BAJA.map(m => `<option>${m}</option>`).join("")}</select></label>
        <label class="campo"><span>Fecha de baja</span><input type="date" id="b-fecha" value="${S.hoyStr()}" max="${S.hoyStr()}"></label>
        <label class="campo"><span>Detalle (opcional)</span><input type="text" id="b-det" placeholder="Ej: cilindro con corrosión en la base"></label>
        ${e.nfc_uid ? `<label class="check"><input type="checkbox" id="b-nfc-lib" checked> Liberar la etiqueta NFC para usarla en otro extintor</label>` : ""}
      </div>`,
      acciones: [{ txt: "Cancelar" }, {
        txt: "Dar de baja", clase: "prim", fn: async el => {
          const motivo = $("#b-motivo", el).value;
          if (!motivo) throw new Error("Elegí el motivo de la baja");
          const det = $("#b-det", el).value.trim();
          const cambios = { estado: "Baja", fecha_baja: $("#b-fecha", el).value || S.hoyStr(), motivo_baja: det ? `${motivo}: ${det}` : motivo, observado: false };
          const lib = $("#b-nfc-lib", el);
          if (lib && lib.checked) cambios.nfc_uid = null;
          await S.update("extintores", e.id, cambios);
          toast(`${e.codigo} dado de baja`);
        }
      }]
    });
    $("#b-recarga").onclick = () => pedirFecha("Registrar recarga", "ultima_recarga", `El nuevo vencimiento se calcula a ${e.meses_recarga || 12} meses.`);
    $("#b-ph").onclick = () => pedirFecha("Registrar prueba hidráulica", "ultima_ph", `El nuevo vencimiento se calcula a ${e.meses_ph || 60} meses.`);
    $("#b-nfc").onclick = async () => {
      const uid = await leerNFC("Vincular etiqueta");
      if (!uid) return;
      const otro = D.extintores.find(x => (x.nfc_uid || "").toUpperCase() === uid && x.id !== e.id);
      if (otro) return toast(`Esa etiqueta ya está en ${otro.codigo}`, 4000);
      await S.update("extintores", e.id, { nfc_uid: uid }); toast("Etiqueta vinculada");
    };
    const br = $("#b-resolver");
    if (br) br.onclick = async () => {
      if (await confirmar("Resolver observación", "¿La falla detectada ya fue corregida?", "Sí, resuelta")) {
        await S.update("extintores", e.id, { observado: false }); toast("Observación resuelta");
      }
    };
    vistaViva = true;
  }

  /* ================= DOCUMENTOS ================= */
  const TIPOS_DOC = ["Ficha técnica", "Certificado de recarga", "Certificado de prueba hidráulica", "Remito / factura", "Foto", "Otro"];
  const MAX_MB = 10;
  const tam = b => !b ? "" : b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1048576).toFixed(1)} MB`;

  function adjuntarDocumento(ext) {
    let archivo = null;
    modal({
      titulo: `Adjuntar a ${ext.codigo}`,
      cuerpo: `<div class="stack">
        <label class="campo"><span>Tipo de documento</span><select id="d-tipo">${TIPOS_DOC.map(t => `<option>${t}</option>`).join("")}</select></label>
        <label class="campo"><span>Archivo (JPG, PNG o PDF, hasta ${MAX_MB} MB)</span>
          <input type="file" id="d-file" accept="image/*,application/pdf,.pdf"></label>
        <div id="d-prev" class="muted small"></div>
        <label class="campo"><span>Fecha del documento</span><input type="date" id="d-fecha" value="${S.hoyStr()}"></label>
        <label class="campo"><span>Descripción (opcional)</span><input type="text" id="d-desc" placeholder="Ej: certificado empresa recargadora, N° 1234"></label>
      </div>`,
      alAbrir: el => {
        $("#d-file", el).onchange = ev => {
          archivo = ev.target.files[0] || null;
          const p = $("#d-prev", el);
          if (!archivo) { p.textContent = ""; return; }
          const esPdf = archivo.type === "application/pdf" || /\.pdf$/i.test(archivo.name);
          p.innerHTML = `${esc(archivo.name)} · ${tam(archivo.size)}`;
          if (!esPdf && !archivo.type.startsWith("image/")) p.innerHTML = `<span class="error">Solo se aceptan imágenes o PDF.</span>`;
          else if (esPdf && archivo.size > MAX_MB * 1048576) p.innerHTML = `<span class="error">El PDF supera ${MAX_MB} MB.</span>`;
          if (esPdf && /recarga/i.test(archivo.name)) $("#d-tipo", el).value = "Certificado de recarga";
        };
      },
      acciones: [{ txt: "Cancelar" }, {
        txt: "Guardar", clase: "prim", fn: async el => {
          if (!archivo) throw new Error("Elegí un archivo");
          const esPdf = archivo.type === "application/pdf" || /\.pdf$/i.test(archivo.name);
          if (!esPdf && !archivo.type.startsWith("image/")) throw new Error("Solo se aceptan imágenes o PDF");
          let blob = archivo, nombre = archivo.name;
          if (esPdf) {
            if (archivo.size > MAX_MB * 1048576) throw new Error(`El PDF supera ${MAX_MB} MB`);
            if (!archivo.type) blob = new Blob([archivo], { type: "application/pdf" });
          } else {
            blob = await comprimir(archivo, 2000, 0.8);
            nombre = nombre.replace(/\.[^.]+$/, "") + ".jpg";
          }
          await S.guardarDocumento({
            extintor_id: ext.id, tipo: $("#d-tipo", el).value, nombre,
            descripcion: $("#d-desc", el).value.trim() || null, fecha: $("#d-fecha", el).value || null
          }, blob);
          await cargar();
          toast(S.DEMO || navigator.onLine ? "Documento adjuntado" : "Guardado. Se sube cuando haya señal", 3200);
          render();
        }
      }]
    });
  }

  async function abrirDocumento(d) {
    if (!d) return;
    const url = await S.urlFoto(d.ruta);
    if (!url) return toast("Para ver este documento hace falta conexión", 3500);
    const esPdf = (d.mime || "").includes("pdf");
    modal({
      titulo: d.tipo || "Documento",
      cuerpo: `<p class="muted small" style="margin-top:0">${esc(d.nombre || "")}${d.descripcion ? " · " + esc(d.descripcion) : ""}<br>
          ${d.fecha ? "Fecha: " + fecha(d.fecha) + " · " : ""}Subido por ${esc(d.subido_por_nombre || "—")}</p>
        ${esPdf ? `<div class="alerta azul">${ic("doc")}<span>Documento PDF (${tam(d.tamano)})</span></div>`
                : `<img src="${url}" alt="${esc(d.tipo || "Documento")}" style="width:100%;border-radius:12px;display:block">`}
        <a class="btn prim full" href="${url}" target="_blank" rel="noopener" style="margin-top:14px">${esPdf ? "Abrir PDF" : "Ver en tamaño completo"}</a>`,
      acciones: [{ txt: "Cerrar" }]
    });
  }

  /* ================= ALTA / EDICIÓN ================= */
  const AGENTES = ["ABC (polvo)", "BC (polvo)", "CO2", "Agua", "Espuma AFFF", "Clase K", "HCFC / Halotron"];
  const ESTADOS = ["Activo", "En recarga", "Fuera de servicio", "Baja"];
  const MOTIVOS_BAJA = ["Vencido sin posibilidad de recarga", "Falla en prueba hidráulica", "Dañado / corroído", "Reemplazado por otro equipo", "Extraviado o robado", "Vendido o devuelto", "Otro"];
  function pantallaEditar(id) {
    const nuevo = id === "nuevo";
    const e = nuevo ? { meses_recarga: 12, meses_ph: 60, frecuencia_dias: 30, estado: "Activo", tipo_ubicacion: "Base" } : D.extintores.find(x => x.id === id);
    if (!e) { location.hash = "#/extintores"; return; }
    let nfc = e.nfc_uid || sessionStorage.getItem("nfcNuevo") || "";
    sessionStorage.removeItem("nfcNuevo");
    const opt = (arr, val) => arr.map(v => `<option ${String(v) === String(val ?? "") ? "selected" : ""}>${esc(v)}</option>`).join("");
    marco({
      titulo: nuevo ? "Nuevo extintor" : `Editar ${e.codigo}`,
      atras: nuevo ? "#/extintores" : `#/extintor/${e.id}`,
      nav: false,
      cuerpo: `<form id="f-ext" class="stack" novalidate>
        <div class="grid2">
          <label class="campo"><span>Código interno *</span><input type="text" name="codigo" value="${esc(e.codigo || "")}" required placeholder="EXT-001"></label>
          <label class="campo"><span>N° de serie *</span><input type="text" name="serie" value="${esc(e.serie || "")}" required></label>
        </div>
        <div class="grid2">
          <label class="campo"><span>Tipo de agente *</span><select name="agente" required><option value="">Elegir…</option>${opt(AGENTES, e.agente)}</select></label>
          <label class="campo"><span>Capacidad (kg) *</span><input type="number" step="0.5" min="0" name="capacidad_kg" value="${esc(e.capacidad_kg ?? "")}" required></label>
        </div>
        <div class="grid2">
          <label class="campo"><span>Marca</span><input type="text" name="marca" value="${esc(e.marca || "")}"></label>
          <label class="campo"><span>Fecha de fabricación *</span><input type="date" name="fecha_fabricacion" value="${esc(e.fecha_fabricacion || "")}" required></label>
        </div>
        <div class="grid2">
          <label class="campo"><span>Última recarga *</span><input type="date" name="ultima_recarga" value="${esc(e.ultima_recarga || "")}" required></label>
          <label class="campo"><span>Recarga cada (meses)</span><input type="number" min="1" name="meses_recarga" value="${esc(e.meses_recarga ?? 12)}"></label>
        </div>
        <div class="grid2">
          <label class="campo"><span>Última PH *</span><input type="date" name="ultima_ph" value="${esc(e.ultima_ph || "")}" required></label>
          <label class="campo"><span>PH cada (meses)</span><input type="number" min="1" name="meses_ph" value="${esc(e.meses_ph ?? 60)}"></label>
        </div>
        <label class="campo"><span>Tipo de ubicación *</span><select name="tipo_ubicacion" id="sel-tu">${opt(TIPOS_UBIC, e.tipo_ubicacion)}</select></label>
        <label class="campo" id="c-ubic"><span>Base, taller o campo *</span><select name="ubicacion_id"><option value="">Elegir…</option>
          ${D.ubicaciones.filter(u => u.activo !== false).map(u => `<option value="${u.id}" data-tipo="${u.tipo}" ${u.id === e.ubicacion_id ? "selected" : ""}>${esc(u.nombre)} (${u.tipo})</option>`).join("")}</select></label>
        <label class="campo" id="c-veh"><span>Patente *</span><select name="vehiculo_id"><option value="">Elegir…</option>
          ${D.vehiculos.filter(v => v.activo !== false).map(v => `<option value="${v.id}" data-tipo="${v.tipo}" ${v.id === e.vehiculo_id ? "selected" : ""}>${esc(v.patente)} — ${esc(v.descripcion || v.tipo)}</option>`).join("")}</select></label>
        <p class="muted small" style="margin-top:4px">¿Falta una base, campo o patente? Cargala en Más → Ubicaciones / Vehículos.</p>
        <label class="campo"><span>Sector o posición</span><input type="text" name="sector" value="${esc(e.sector || "")}" placeholder="Depósito, cabina, ingreso…"></label>
        <div class="grid2">
          <label class="campo"><span>Inspección *</span><select name="frecuencia_dias"><option value="15" ${e.frecuencia_dias == 15 ? "selected" : ""}>Quincenal</option><option value="30" ${e.frecuencia_dias != 15 ? "selected" : ""}>Mensual</option></select></label>
          <label class="campo"><span>Estado *</span><select name="estado">${opt(ESTADOS, e.estado)}</select></label>
        </div>
        <div class="card">
          <div class="row"><div class="grow"><b>Etiqueta NFC</b><div class="muted small mono" id="nfc-txt">${esc(nfc || "Sin vincular")}</div></div>
          <button type="button" class="btn chico" id="b-leer">${ic("nfc")} Leer</button></div>
        </div>
        <label class="campo"><span>Observaciones</span><textarea name="observaciones">${esc(e.observaciones || "")}</textarea></label>
        <div class="error" id="f-err"></div>
        <button class="btn prim full" type="submit">${nuevo ? "Dar de alta" : "Guardar cambios"}</button>
      </form>`
    });
    const tu = $("#sel-tu");
    const ajustar = () => {
      const movil = tu.value === "Pickup" || tu.value === "Trailer";
      $("#c-ubic").classList.toggle("hidden", movil);
      $("#c-veh").classList.toggle("hidden", !movil);
      $$("#c-ubic option[data-tipo]").forEach(o => o.hidden = o.dataset.tipo !== tu.value);
      $$("#c-veh option[data-tipo]").forEach(o => o.hidden = o.dataset.tipo !== tu.value);
      const su = $("#c-ubic select"); if (su.selectedOptions[0] && su.selectedOptions[0].hidden) su.value = "";
      const sv = $("#c-veh select"); if (sv.selectedOptions[0] && sv.selectedOptions[0].hidden) sv.value = "";
    };
    tu.onchange = ajustar; ajustar();
    $("#b-leer").onclick = async () => {
      const uid = await leerNFC("Leer etiqueta");
      if (!uid) return;
      const otro = D.extintores.find(x => (x.nfc_uid || "").toUpperCase() === uid && x.id !== e.id);
      if (otro) return toast(`Esa etiqueta ya está en ${otro.codigo}`, 4000);
      nfc = uid; $("#nfc-txt").textContent = uid;
    };
    $("#f-ext").onsubmit = async ev => {
      ev.preventDefault();
      const f = datosForm(ev.target);
      const err = m => { $("#f-err").textContent = m; };
      const req = { codigo: "Código", serie: "N° de serie", agente: "Tipo de agente", capacidad_kg: "Capacidad", fecha_fabricacion: "Fecha de fabricación", ultima_recarga: "Última recarga", ultima_ph: "Última PH" };
      for (const k in req) if (!String(f[k] || "").trim()) return err(`Falta: ${req[k]}`);
      const movil = f.tipo_ubicacion === "Pickup" || f.tipo_ubicacion === "Trailer";
      if (movil && !f.vehiculo_id) return err("Elegí la patente");
      if (!movil && !f.ubicacion_id) return err("Elegí la base, taller o campo");
      const codigo = f.codigo.trim().toUpperCase();
      if (D.extintores.some(x => x.codigo.toUpperCase() === codigo && x.id !== e.id)) return err("Ya existe un extintor con ese código");
      const datos = {
        codigo, serie: f.serie.trim(), agente: f.agente, capacidad_kg: Number(f.capacidad_kg), marca: f.marca.trim() || null,
        fecha_fabricacion: f.fecha_fabricacion, ultima_recarga: f.ultima_recarga, meses_recarga: Number(f.meses_recarga || 12),
        ultima_ph: f.ultima_ph, meses_ph: Number(f.meses_ph || 60), tipo_ubicacion: f.tipo_ubicacion,
        ubicacion_id: movil ? null : f.ubicacion_id, vehiculo_id: movil ? f.vehiculo_id : null,
        sector: f.sector.trim() || null, frecuencia_dias: Number(f.frecuencia_dias), estado: f.estado,
        observaciones: f.observaciones.trim() || null, nfc_uid: nfc || null
      };
      if (f.estado === "Baja" && e.estado !== "Baja") { datos.fecha_baja = S.hoyStr(); datos.motivo_baja = e.motivo_baja || "Otro"; }
      if (f.estado !== "Baja" && e.estado === "Baja") { datos.fecha_baja = null; datos.motivo_baja = null; }
      if (nuevo) {
        const r = await S.save("extintores", Object.assign({ observado: false, ultima_inspeccion: null }, datos));
        toast("Extintor dado de alta");
        location.replace(`#/extintor/${r.id}`);
      } else {
        await S.update("extintores", e.id, datos);
        toast("Cambios guardados");
        history.back();
      }
    };
  }

  /* ================= INSPECCIÓN ================= */
  function pantallaInspeccion(id, conNfc) {
    const e = D.extintores.find(x => x.id === id);
    if (!e) { location.hash = "#/inicio"; return; }
    const ag = (e.agente || "").toUpperCase();
    const items = D.checklist_items.filter(i => i.activo !== false).filter(i => {
      if (!i.aplica) return true;
      const [modo, val] = i.aplica.split(":");
      const tiene = ag.includes((val || "").toUpperCase());
      return modo === "solo" ? tiene : !tiene;
    });
    const resp = {};
    const fotos = [];
    let pos = null;
    marco({
      titulo: `Inspección ${e.codigo}`,
      atras: `#/extintor/${e.id}`,
      nav: false,
      cuerpo: `
        <div class="card">
          <div class="row"><div class="grow"><h2>${esc(e.codigo)}</h2><div class="muted small">${esc(e.agente || "")} ${esc(e.capacidad_kg || "")} kg · ${esc(dondeEsta(e))}${e.sector ? " · " + esc(e.sector) : ""}</div></div></div>
          <div style="margin-top:10px">${conNfc ? `<span class="badge b-verde">${"✓"} Etiqueta NFC leída</span>` : `<span class="badge b-amarillo">Sin lectura NFC</span>`}
          <span class="badge b-gris" id="gps-tag">Buscando GPS…</span></div>
        </div>
        <div class="seccion">Checklist</div>
        <div class="card">${items.map(i => `
          <div class="item-chk" data-id="${i.id}">
            <div class="txt">${esc(i.texto)}</div>
            <div class="seg"><button type="button" class="ok">${"✓"} OK</button><button type="button" class="nok">${"✗"} No OK</button></div>
          </div>`).join("") || `<div class="muted">No hay ítems de checklist cargados.</div>`}
          <button type="button" class="btn chico" id="todo-ok" style="margin-top:12px">Marcar todo OK</button>
        </div>
        <div class="seccion">Fotos (1 a 2)</div>
        <div class="card"><div class="fotos" id="fotos"></div>
          <input type="file" id="in-foto" accept="image/*" class="hidden"></div>
        <div class="seccion">Observaciones</div>
        <textarea id="obs" placeholder="Obligatorio si algún ítem está No OK"></textarea>
        <div class="error" id="i-err" style="margin-top:10px"></div>
        <button class="btn prim full" id="guardar" style="margin-top:14px">Guardar inspección</button>`
    });
    gps().then(p => {
      pos = p;
      const t = $("#gps-tag"); if (!t) return;
      t.textContent = p ? `GPS ±${Math.round(p.prec)} m` : "Sin GPS";
      t.className = "badge " + (p ? "b-azul" : "b-gris");
    });
    $$(".item-chk").forEach(div => {
      const [bo, bn] = $$("button", div);
      const set = v => { resp[div.dataset.id] = v; bo.classList.toggle("on", v === true); bn.classList.toggle("on", v === false); };
      bo.onclick = () => set(true); bn.onclick = () => set(false);
      div._set = set;
    });
    $("#todo-ok").onclick = () => $$(".item-chk").forEach(d => d._set(true));
    const pintarFotos = () => {
      $("#fotos").innerHTML = fotos.map((f, i) => `<div class="foto"><img src="${f.url}" alt="Foto ${i + 1}"><button type="button" class="quitar" data-i="${i}" aria-label="Quitar">✕</button></div>`).join("") +
        (fotos.length < 2 ? `<button type="button" class="foto-add" id="add-foto">${ic("camara")}<br>Cámara o galería</button>` : "");
      $$(".quitar").forEach(b => b.onclick = () => { URL.revokeObjectURL(fotos[+b.dataset.i].url); fotos.splice(+b.dataset.i, 1); pintarFotos(); });
      const a = $("#add-foto"); if (a) a.onclick = () => $("#in-foto").click();
    };
    $("#in-foto").onchange = async ev => {
      const file = ev.target.files[0]; ev.target.value = "";
      if (!file) return;
      try { const blob = await comprimir(file); fotos.push({ blob, url: URL.createObjectURL(blob) }); pintarFotos(); }
      catch (e2) { toast("No se pudo procesar la foto"); }
    };
    pintarFotos();
    $("#guardar").onclick = async () => {
      const err = m => { $("#i-err").textContent = m; $("#i-err").scrollIntoView({ block: "center", behavior: "smooth" }); };
      const faltan = items.filter(i => resp[i.id] === undefined);
      if (faltan.length) return err(`Faltan ${faltan.length} ítem${faltan.length === 1 ? "" : "s"} del checklist`);
      if (!fotos.length) return err("Agregá al menos una foto");
      const todoOk = items.every(i => resp[i.id] === true);
      const obs = $("#obs").value.trim();
      if (!todoOk && !obs) return err("Describí la falla en Observaciones");
      const btn = $("#guardar"); btn.disabled = true; btn.textContent = "Guardando…";
      try {
        await S.guardarInspeccion({
          extintor_id: e.id, fecha: new Date().toISOString(), inspector_id: S.usuario.id,
          inspector_nombre: S.perfil.nombre || S.usuario.email, nfc_leido: !!conNfc,
          resultados: items.map(i => ({ item_id: i.id, texto: i.texto, ok: resp[i.id] })),
          todo_ok: todoOk, observaciones: obs || null,
          lat: pos ? pos.lat : null, lng: pos ? pos.lng : null
        }, fotos.map(f => f.blob));
        await cargar();
        toast(S.DEMO || navigator.onLine ? "Inspección guardada" : "Guardada. Se sube cuando haya señal", 3200);
        location.replace(`#/extintor/${e.id}`);
      } catch (e2) { err(e2.message || String(e2)); btn.disabled = false; btn.textContent = "Guardar inspección"; }
    };
  }

  /* ================= MAPA ================= */
  function cargarLeaflet() {
    if (window.L) return Promise.resolve();
    return new Promise((res, rej) => {
      const css = document.createElement("link");
      css.rel = "stylesheet"; css.href = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css";
      document.head.appendChild(css);
      const s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js";
      s.onload = res; s.onerror = rej; document.head.appendChild(s);
    });
  }
  function resumen(lista) {
    const c = lista.map(e => S.calcular(e));
    return { total: lista.length, rojo: c.filter(x => x.nivel === "rojo").length, amarillo: c.filter(x => x.nivel === "amarillo").length };
  }
  async function pantallaMapa() {
    const act = D.extintores.filter(e => e.estado !== "Baja");
    const fijas = D.ubicaciones.filter(u => u.activo !== false).map(u => ({ u, r: resumen(act.filter(e => e.ubicacion_id === u.id)) }));
    const moviles = D.vehiculos.filter(v => v.activo !== false).map(v => ({ v, r: resumen(act.filter(e => e.vehiculo_id === v.id)) }));
    const fila = (href, icono, titulo, sub, r) => `<a class="ext-item" href="${href}">
      <div class="barra ${r.rojo ? "rojo" : r.amarillo ? "amarillo" : r.total ? "verde" : "gris"}"></div>
      <div class="grow"><div class="row"><b class="grow">${esc(titulo)}</b><span class="muted small">${r.total} ext.</span></div>
      <div class="det">${esc(sub)}</div>
      <div class="tags">${r.rojo ? `<span class="badge b-rojo">${r.rojo} rojo</span>` : ""}${r.amarillo ? `<span class="badge b-amarillo">${r.amarillo} amarillo</span>` : ""}${!r.rojo && !r.amarillo && r.total ? `<span class="badge b-verde">En regla</span>` : ""}</div></div></a>`;
    marco({
      titulo: "Mapa",
      cuerpo: `<div id="mapa"><div class="vacio">Cargando mapa…</div></div>
        <div class="seccion">Bases, talleres y campos</div>
        ${fijas.map(x => fila(`#/extintores?ubic=${x.u.id}`, "pin", x.u.nombre, `${x.u.tipo}${x.u.direccion ? " · " + x.u.direccion : ""}${x.u.lat == null ? " · sin coordenadas" : ""}`, x.r)).join("") || `<div class="muted">No hay ubicaciones cargadas.</div>`}
        <div class="seccion">Vehículos</div>
        ${moviles.map(x => fila(`#/extintores?veh=${x.v.id}`, "camion", x.v.patente, `${x.v.tipo}${x.v.descripcion ? " · " + x.v.descripcion : ""}${x.v.base_id && ubic(x.v.base_id) ? " · " + ubic(x.v.base_id).nombre : ""}`, x.r)).join("") || `<div class="muted">No hay vehículos cargados.</div>`}`
    });
    const conCoord = fijas.filter(x => x.u.lat != null && x.u.lng != null);
    if (!conCoord.length) { $("#mapa").innerHTML = `<div class="vacio">Cargá las coordenadas de las bases (Más → Ubicaciones) para verlas en el mapa.</div>`; return; }
    try {
      await cargarLeaflet();
      if (!$("#mapa")) return;
      $("#mapa").innerHTML = "";
      const map = L.map("mapa", { zoomControl: true, attributionControl: true });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18, attribution: "© OpenStreetMap" }).addTo(map);
      const pts = [];
      conCoord.forEach(({ u, r }) => {
        const color = r.rojo ? "#d42a20" : r.amarillo ? "#e3a21a" : r.total ? "#1f8a4c" : "#6b7280";
        L.circleMarker([u.lat, u.lng], { radius: 12, color: "#fff", weight: 3, fillColor: color, fillOpacity: 1 }).addTo(map)
          .bindPopup(`<b>${esc(u.nombre)}</b><br>${r.total} extintores${r.rojo ? `<br><span style="color:#d42a20">${r.rojo} en rojo</span>` : ""}${r.amarillo ? `<br><span style="color:#b97600">${r.amarillo} en amarillo</span>` : ""}<br><a href="#/extintores?ubic=${u.id}">Ver extintores</a>`);
        pts.push([u.lat, u.lng]);
      });
      if (pts.length === 1) map.setView(pts[0], 13); else map.fitBounds(pts, { padding: [30, 30] });
    } catch (e) {
      const m = $("#mapa"); if (m) m.innerHTML = `<div class="vacio">El mapa necesita conexión. La lista de abajo funciona igual.</div>`;
    }
  }

  /* ================= MÁS ================= */
  async function pantallaMas() {
    const seg = S.esSeguridad();
    const errores = S.DEMO ? [] : await S.erroresCola();
    const e = S.estado;
    marco({
      titulo: "Más",
      cuerpo: `
        <div class="card"><div class="row"><div class="grow"><b>${esc(S.perfil.nombre || "")}</b><div class="muted small">${esc(S.perfil.email || "")} · ${seg ? "Seguridad" : "Operador"}</div></div></div></div>
        ${S.DEMO ? `<div class="alerta azul" style="margin-top:12px"><span>Modo demo: completá <span class="mono">js/config.js</span> con los datos de Supabase para usar la app real.</span></div>` : `
        <div class="seccion">Sincronización</div>
        <div class="card stack">
          <div>${navigator.onLine ? "Con conexión" : "Sin conexión"} · ${e.pendientes} pendiente${e.pendientes === 1 ? "" : "s"}${e.ultimaSync ? ` · última: ${fechaHora(e.ultimaSync)}` : ""}</div>
          ${e.mensaje ? `<div class="error">${esc(e.mensaje)}</div>` : ""}
          ${errores.map(o => `<div class="alerta rojo"><span class="grow small">No se pudo subir (${esc(o.tabla || "inspección")}): ${esc(o.error)}</span><button class="btn chico" data-desc="${o.seq}">Descartar</button></div>`).join("")}
          <button class="btn full" id="b-sync">${ic("sync")} Sincronizar ahora</button>
        </div>`}
        ${seg ? `
        <div class="seccion">Administración</div>
        <div class="card lista-simple">
          <div><a class="grow row" href="#/admin/usuarios" style="color:inherit;text-decoration:none">${ic("usuarios")} Usuarios</a></div>
          <div><a class="grow row" href="#/admin/ubicaciones" style="color:inherit;text-decoration:none">${ic("pin")} Ubicaciones (bases, talleres y campos)</a></div>
          <div><a class="grow row" href="#/admin/vehiculos" style="color:inherit;text-decoration:none">${ic("camion")} Vehículos (pickups y trailers)</a></div>
          <div><a class="grow row" href="#/admin/checklist" style="color:inherit;text-decoration:none">${ic("chk")} Ítems del checklist</a></div>
          <div><a class="grow row" href="#/exportar" style="color:inherit;text-decoration:none">${ic("descarga")} Exportar a Excel</a></div>
        </div>` : ""}
        <div class="seccion">Cuenta</div>
        <div class="card stack">
          ${S.DEMO ? "" : `<button class="btn full" id="b-clave">${ic("llave")} Cambiar contraseña</button>`}
          <button class="btn full peligro" id="b-salir">${ic("salir")} ${S.DEMO ? "Cambiar de rol" : "Cerrar sesión"}</button>
        </div>
        <p class="muted small center" style="margin-top:20px">Control de Extintores · v1.2.0</p>`
    });
    const bs = $("#b-sync"); if (bs) bs.onclick = () => S.sync(true);
    $$("[data-desc]").forEach(b => b.onclick = async () => {
      if (await confirmar("Descartar cambio", "Este cambio no se va a subir nunca. ¿Descartarlo?", "Descartar")) { await S.descartarError(+b.dataset.desc); render(); }
    });
    const bc = $("#b-clave"); if (bc) bc.onclick = () => modal({
      titulo: "Cambiar contraseña",
      cuerpo: `<label class="campo"><span>Nueva contraseña (mínimo 8)</span><input type="password" id="n-clave" autocomplete="new-password"></label>`,
      acciones: [{ txt: "Cancelar" }, { txt: "Guardar", clase: "prim", fn: async el => { const v = $("#n-clave", el).value; if (v.length < 8) throw new Error("Mínimo 8 caracteres"); await S.cambiarClave(v); toast("Contraseña actualizada"); } }]
    });
    $("#b-salir").onclick = async () => {
      if (!S.DEMO && S.estado.pendientes) {
        if (!await confirmar("Hay datos sin subir", `Tenés ${S.estado.pendientes} cambios sin sincronizar. Si cerrás sesión se pierden.`, "Cerrar igual")) return;
      }
      await S.logout(); location.hash = "#/inicio"; render();
    };
    vistaViva = true;
  }

  /* ================= ADMINISTRACIÓN ================= */
  function pantallaAdmin(sec) {
    if (sec === "usuarios") return adminUsuarios();
    if (sec === "ubicaciones") return adminUbicaciones();
    if (sec === "vehiculos") return adminVehiculos();
    if (sec === "checklist") return adminChecklist();
    location.hash = "#/mas";
  }

  function adminUsuarios() {
    const pend = D.perfiles.filter(p => !p.activo);
    const fila = p => `<div>
      <div class="grow"><b>${esc(p.nombre || p.email)}</b><div class="muted small">${esc(p.email || "")}</div>
        <div class="tags row wrap" style="margin-top:4px;gap:6px">
          <span class="badge ${p.rol === "seguridad" ? "b-rojo" : "b-azul"}">${p.rol === "seguridad" ? "Seguridad" : "Operador"}</span>
          ${p.activo ? `<span class="badge b-verde">Activo</span>` : `<span class="badge b-gris">${p.created_at ? "Pendiente / baja" : "Inactivo"}</span>`}
          ${p.recibe_alarmas && p.rol === "seguridad" ? `<span class="badge b-amarillo">Recibe alarmas</span>` : ""}
        </div></div>
      <button class="btn chico" data-ed="${p.id}">Editar</button></div>`;
    marco({
      titulo: "Usuarios", atras: "#/mas",
      fab: { label: "Nuevo usuario", fn: nuevoUsuario },
      cuerpo: `${pend.length ? `<div class="alerta amarillo" style="margin-bottom:12px">${pend.length} usuario${pend.length === 1 ? "" : "s"} inactivo${pend.length === 1 ? "" : "s"}.</div>` : ""}
        <div class="card lista-simple">${D.perfiles.map(fila).join("") || `<div class="muted">Sin usuarios.</div>`}</div>
        <p class="muted small">Dar de baja a un usuario le impide ingresar; sus inspecciones quedan en el historial.</p>`
    });
    $$("[data-ed]").forEach(b => b.onclick = () => {
      const p = D.perfiles.find(x => x.id === b.dataset.ed);
      const yo = p.id === S.usuario.id;
      modal({
        titulo: p.nombre || p.email,
        cuerpo: `<div class="stack">
          <label class="campo"><span>Nombre</span><input type="text" id="u-nom" value="${esc(p.nombre || "")}"></label>
          <label class="campo"><span>Rol</span><select id="u-rol" ${yo ? "disabled" : ""}><option value="operador" ${p.rol === "operador" ? "selected" : ""}>Operador</option><option value="seguridad" ${p.rol === "seguridad" ? "selected" : ""}>Seguridad</option></select></label>
          <label class="check"><input type="checkbox" id="u-act" ${p.activo ? "checked" : ""} ${yo ? "disabled" : ""}> Usuario activo (puede ingresar)</label>
          <label class="check"><input type="checkbox" id="u-alarm" ${p.recibe_alarmas ? "checked" : ""}> Recibe alarmas por mail</label>
          ${yo ? `<p class="muted small">No podés cambiar tu propio rol ni darte de baja.</p>` : ""}</div>`,
        acciones: [{ txt: "Cancelar" }, {
          txt: "Guardar", clase: "prim", fn: async el => {
            const cambios = { nombre: $("#u-nom", el).value.trim(), recibe_alarmas: $("#u-alarm", el).checked };
            if (!yo) { cambios.rol = $("#u-rol", el).value; cambios.activo = $("#u-act", el).checked; }
            await S.update("perfiles", p.id, cambios); await cargar(); toast("Usuario actualizado"); render();
          }
        }]
      });
    });
  }
  function nuevoUsuario() {
    modal({
      titulo: "Nuevo usuario",
      cuerpo: `<div class="stack">
        <label class="campo"><span>Nombre y apellido</span><input type="text" id="n-nom"></label>
        <label class="campo"><span>Mail</span><input type="email" id="n-mail"></label>
        <label class="campo"><span>Contraseña inicial (mínimo 8)</span><input type="text" id="n-clave" autocomplete="off"></label>
        <label class="campo"><span>Rol</span><select id="n-rol"><option value="operador">Operador</option><option value="seguridad">Seguridad</option></select></label>
        <p class="muted small">Pasale el mail y la contraseña a la persona. Puede cambiarla después desde Más.</p></div>`,
      acciones: [{ txt: "Cancelar" }, {
        txt: "Crear", clase: "prim", fn: async el => {
          const nombre = $("#n-nom", el).value.trim(), email = $("#n-mail", el).value.trim(), clave = $("#n-clave", el).value, rol = $("#n-rol", el).value;
          if (!nombre || !email) throw new Error("Completá nombre y mail");
          if (clave.length < 8) throw new Error("La contraseña debe tener al menos 8 caracteres");
          await S.crearUsuario({ nombre, email, clave, rol });
          await cargar(); toast("Usuario creado"); render();
        }
      }]
    });
  }

  function adminUbicaciones() {
    marco({
      titulo: "Ubicaciones", atras: "#/mas",
      fab: { label: "Nueva ubicación", fn: () => formUbicacion({ tipo: "Base", activo: true }) },
      cuerpo: `<div class="card lista-simple">${D.ubicaciones.map(u => `<div>
          <div class="grow"><b>${esc(u.nombre)}</b> <span class="badge b-gris">${u.tipo}</span>${u.activo === false ? ` <span class="badge b-gris">Inactiva</span>` : ""}
          <div class="muted small">${esc(u.direccion || "")}${u.lat != null ? ` · ${(+u.lat).toFixed(4)}, ${(+u.lng).toFixed(4)}` : " · sin coordenadas"}</div></div>
          <button class="btn chico" data-ed="${u.id}">Editar</button></div>`).join("") || `<div class="muted">Todavía no hay bases, talleres ni campos.</div>`}</div>`
    });
    $$("[data-ed]").forEach(b => b.onclick = () => formUbicacion(D.ubicaciones.find(x => x.id === b.dataset.ed)));
  }
  function formUbicacion(u) {
    modal({
      titulo: u.id ? "Editar ubicación" : "Nueva ubicación",
      cuerpo: `<form class="stack" id="f-u">
        <label class="campo"><span>Nombre *</span><input type="text" name="nombre" value="${esc(u.nombre || "")}"></label>
        <label class="campo"><span>Tipo</span><select name="tipo">${TIPOS_FIJOS.map(t => `<option ${u.tipo === t ? "selected" : ""}>${t}</option>`).join("")}</select></label>
        <label class="campo"><span>Dirección o referencia</span><input type="text" name="direccion" value="${esc(u.direccion || "")}"></label>
        <div class="grid2"><label class="campo"><span>Latitud</span><input type="number" step="any" name="lat" value="${esc(u.lat ?? "")}"></label>
        <label class="campo"><span>Longitud</span><input type="number" step="any" name="lng" value="${esc(u.lng ?? "")}"></label></div>
        <button type="button" class="btn full" id="b-gps">${ic("pin")} Usar mi ubicación actual</button>
        <label class="check"><input type="checkbox" name="activo" ${u.activo !== false ? "checked" : ""}> Activa</label></form>`,
      alAbrir: el => { $("#b-gps", el).onclick = async () => { toast("Buscando GPS…"); const p = await gps(); if (!p) return toast("No se pudo obtener la ubicación"); $("[name=lat]", el).value = p.lat.toFixed(6); $("[name=lng]", el).value = p.lng.toFixed(6); }; },
      acciones: [{ txt: "Cancelar" }, {
        txt: "Guardar", clase: "prim", fn: async el => {
          const f = datosForm($("#f-u", el));
          if (!f.nombre.trim()) throw new Error("Falta el nombre");
          if (D.ubicaciones.some(x => x.nombre.toLowerCase() === f.nombre.trim().toLowerCase() && x.id !== u.id)) throw new Error("Ya existe una ubicación con ese nombre");
          await S.save("ubicaciones", { id: u.id, nombre: f.nombre.trim(), tipo: f.tipo, direccion: f.direccion.trim() || null, lat: f.lat === "" ? null : +f.lat, lng: f.lng === "" ? null : +f.lng, activo: !!f.activo });
          await cargar(); toast("Guardado"); render();
        }
      }]
    });
  }

  function adminVehiculos() {
    marco({
      titulo: "Vehículos", atras: "#/mas",
      fab: { label: "Nuevo vehículo", fn: () => formVehiculo({ tipo: "Pickup", activo: true }) },
      cuerpo: `<div class="card lista-simple">${D.vehiculos.map(v => `<div>
          <div class="grow"><b class="mono">${esc(v.patente)}</b> <span class="badge b-gris">${v.tipo}</span>${v.activo === false ? ` <span class="badge b-gris">Inactivo</span>` : ""}
          <div class="muted small">${esc(v.descripcion || "")}${v.base_id && ubic(v.base_id) ? " · " + esc(ubic(v.base_id).nombre) : ""}</div></div>
          <button class="btn chico" data-ed="${v.id}">Editar</button></div>`).join("") || `<div class="muted">Todavía no hay vehículos.</div>`}</div>`
    });
    $$("[data-ed]").forEach(b => b.onclick = () => formVehiculo(D.vehiculos.find(x => x.id === b.dataset.ed)));
  }
  function formVehiculo(v) {
    modal({
      titulo: v.id ? "Editar vehículo" : "Nuevo vehículo",
      cuerpo: `<form class="stack" id="f-v">
        <label class="campo"><span>Patente *</span><input type="text" name="patente" value="${esc(v.patente || "")}" style="text-transform:uppercase"></label>
        <label class="campo"><span>Tipo</span><select name="tipo"><option ${v.tipo === "Pickup" ? "selected" : ""}>Pickup</option><option ${v.tipo === "Trailer" ? "selected" : ""}>Trailer</option></select></label>
        <label class="campo"><span>Descripción</span><input type="text" name="descripcion" value="${esc(v.descripcion || "")}" placeholder="Marca, uso, interno…"></label>
        <label class="campo"><span>Base asignada</span><select name="base_id"><option value="">Ninguna</option>${D.ubicaciones.map(u => `<option value="${u.id}" ${u.id === v.base_id ? "selected" : ""}>${esc(u.nombre)}</option>`).join("")}</select></label>
        <label class="check"><input type="checkbox" name="activo" ${v.activo !== false ? "checked" : ""}> Activo</label></form>`,
      acciones: [{ txt: "Cancelar" }, {
        txt: "Guardar", clase: "prim", fn: async el => {
          const f = datosForm($("#f-v", el));
          const pat = f.patente.trim().toUpperCase().replace(/\s+/g, "");
          if (!pat) throw new Error("Falta la patente");
          if (D.vehiculos.some(x => x.patente === pat && x.id !== v.id)) throw new Error("Esa patente ya existe");
          await S.save("vehiculos", { id: v.id, patente: pat, tipo: f.tipo, descripcion: f.descripcion.trim() || null, base_id: f.base_id || null, activo: !!f.activo });
          await cargar(); toast("Guardado"); render();
        }
      }]
    });
  }

  function adminChecklist() {
    const aplicaTxt = a => !a ? "Todos los agentes" : a.startsWith("solo:") ? "Solo " + a.slice(5) : "Excepto " + a.slice(8);
    marco({
      titulo: "Checklist", atras: "#/mas",
      fab: { label: "Nuevo ítem", fn: () => formItem({ orden: (D.checklist_items.length + 1), activo: true }) },
      cuerpo: `<p class="muted small" style="margin-top:0">Estos ítems aparecen en cada inspección. Los cambios aplican a las inspecciones nuevas.</p>
        <div class="card lista-simple">${D.checklist_items.map(i => `<div>
          <div class="grow"><b>${i.orden}. ${esc(i.texto)}</b><div class="muted small">${aplicaTxt(i.aplica)}${i.activo === false ? " · desactivado" : ""}</div></div>
          <button class="btn chico" data-ed="${i.id}">Editar</button></div>`).join("") || `<div class="muted">Sin ítems.</div>`}</div>`
    });
    $$("[data-ed]").forEach(b => b.onclick = () => formItem(D.checklist_items.find(x => x.id === b.dataset.ed)));
  }
  function formItem(i) {
    const ap = i.aplica || "";
    modal({
      titulo: i.id ? "Editar ítem" : "Nuevo ítem",
      cuerpo: `<form class="stack" id="f-i">
        <label class="campo"><span>Texto *</span><input type="text" name="texto" value="${esc(i.texto || "")}"></label>
        <div class="grid2"><label class="campo"><span>Orden</span><input type="number" name="orden" value="${esc(i.orden || 1)}"></label>
        <label class="campo"><span>Aplica a</span><select name="aplica">
          <option value="" ${!ap ? "selected" : ""}>Todos</option>
          <option value="excepto:CO2" ${ap === "excepto:CO2" ? "selected" : ""}>Todos menos CO2</option>
          <option value="solo:CO2" ${ap === "solo:CO2" ? "selected" : ""}>Solo CO2</option></select></label></div>
        <label class="check"><input type="checkbox" name="activo" ${i.activo !== false ? "checked" : ""}> Activo</label></form>`,
      acciones: [{ txt: "Cancelar" }, {
        txt: "Guardar", clase: "prim", fn: async el => {
          const f = datosForm($("#f-i", el));
          if (!f.texto.trim()) throw new Error("Falta el texto");
          await S.save("checklist_items", { id: i.id, texto: f.texto.trim(), orden: Number(f.orden || 0), aplica: f.aplica || null, activo: !!f.activo });
          await cargar(); toast("Guardado"); render();
        }
      }]
    });
  }

  /* ================= EXPORTAR ================= */
  function cargarXLSX() {
    if (window.XLSX) return Promise.resolve();
    return new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
      s.onload = res; s.onerror = () => rej(new Error("No se pudo cargar el generador de Excel (¿sin conexión?)"));
      document.head.appendChild(s);
    });
  }
  function pantallaExportar() {
    const hace90 = new Date(Date.now() - 90 * 864e5).toISOString().slice(0, 10);
    marco({
      titulo: "Exportar a Excel", atras: "#/mas",
      cuerpo: `<div class="card stack">
        <p style="margin:0">Genera un Excel con tres hojas: <b>Extintores</b>, <b>Inspecciones</b> y <b>Vencimientos</b>.</p>
        <label class="campo"><span>Ubicación o vehículo</span><select id="x-filtro"><option value="">Todos</option>
          <optgroup label="Bases, talleres y campos">${D.ubicaciones.map(u => `<option value="u:${u.id}">${esc(u.nombre)}</option>`).join("")}</optgroup>
          <optgroup label="Vehículos">${D.vehiculos.map(v => `<option value="v:${v.id}">${esc(v.patente)}</option>`).join("")}</optgroup></select></label>
        <div class="grid2">
          <label class="campo"><span>Inspecciones desde</span><input type="date" id="x-desde" value="${hace90}"></label>
          <label class="campo"><span>Hasta</span><input type="date" id="x-hasta" value="${S.hoyStr()}"></label>
        </div>
        <label class="check"><input type="checkbox" id="x-links" ${S.DEMO ? "disabled" : "checked"}> Incluir links a las fotos (válidos 7 días)</label>
        <div class="error" id="x-err"></div>
        <button class="btn prim full" id="x-go">${ic("descarga")} Descargar Excel</button></div>`
    });
    $("#x-go").onclick = async () => {
      const btn = $("#x-go"); btn.disabled = true; btn.textContent = "Generando…"; $("#x-err").textContent = "";
      try { await exportar($("#x-filtro").value, $("#x-desde").value, $("#x-hasta").value, $("#x-links").checked && !S.DEMO); toast("Excel descargado"); }
      catch (e) { $("#x-err").textContent = e.message || String(e); }
      finally { btn.disabled = false; btn.innerHTML = `${ic("descarga")} Descargar Excel`; }
    };
  }
  const aFecha = s => { if (!s) return null; const [y, m, d] = s.slice(0, 10).split("-").map(Number); return new Date(y, m - 1, d); };
  async function exportar(filtro, desde, hasta, conLinks) {
    await cargarXLSX();
    let exts = D.extintores.slice();
    if (filtro.startsWith("u:")) exts = exts.filter(e => e.ubicacion_id === filtro.slice(2));
    if (filtro.startsWith("v:")) exts = exts.filter(e => e.vehiculo_id === filtro.slice(2));
    const ids = new Set(exts.map(e => e.id));
    const alarmaTxt = c => !c.activo ? "Sin alarma (no activo)" : c.venc === "vencido" ? "VENCIDO" : c.observado ? "OBSERVADO" : c.venc === "proximo" ? "PRÓXIMO A VENCER" : c.atrasada ? "INSPECCIÓN ATRASADA" : c.venc === "sin_datos" ? "SIN FECHAS" : "VIGENTE";
    const h1 = exts.map(e => {
      const c = S.calcular(e);
      return {
        "Código": e.codigo, "N° de serie": e.serie || "", "Etiqueta NFC": e.nfc_uid || "", "Tipo de agente": e.agente || "", "Capacidad (kg)": e.capacidad_kg ?? "",
        "Marca": e.marca || "", "Fecha de fabricación": aFecha(e.fecha_fabricacion), "Última recarga": aFecha(e.ultima_recarga), "Vencimiento de carga": aFecha(c.vencCarga),
        "Última PH": aFecha(e.ultima_ph), "Vencimiento de PH": aFecha(c.vencPh), "Tipo de ubicación": e.tipo_ubicacion || "", "Ubicación o patente": dondeEsta(e).replace(/^(Pickup|Trailer) /, ""),
        "Sector": e.sector || "", "Frecuencia": e.frecuencia_dias == 15 ? "Quincenal" : "Mensual", "Estado": e.estado || "", "Última inspección": e.ultima_inspeccion ? new Date(e.ultima_inspeccion) : null,
        "Observado": e.observado ? "Sí" : "No", "Días al próximo vencimiento": c.dias ?? "", "Alarma": alarmaTxt(c), "Fecha de baja": aFecha(e.fecha_baja), "Motivo de baja": e.motivo_baja || "", "Observaciones": e.observaciones || ""
      };
    });
    const d0 = desde || "0000-01-01", d1 = hasta || "9999-12-31";
    const diaLocal = iso => { const d = new Date(iso); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
    const insp = D.inspecciones.filter(i => { const dl = diaLocal(i.fecha); return ids.has(i.extintor_id) && dl >= d0 && dl <= d1; });
    let links = {};
    if (conLinks && navigator.onLine) {
      const rutas = insp.flatMap(i => i.fotos || []);
      for (let k = 0; k < rutas.length; k += 100) {
        const { data } = await S.sb.storage.from("fotos").createSignedUrls(rutas.slice(k, k + 100), 7 * 24 * 3600);
        (data || []).forEach(x => { if (x.signedUrl) links[x.path] = x.signedUrl; });
      }
    }
    const textos = [...new Set(insp.flatMap(i => (i.resultados || []).map(r => r.texto)))];
    const h2 = insp.map(i => {
      const e = D.extintores.find(x => x.id === i.extintor_id) || {};
      const fila = { "Fecha": new Date(i.fecha), "Código": e.codigo || "", "Ubicación o patente": e.id ? dondeEsta(e) : "", "Inspector": i.inspector_nombre || "", "NFC leído": i.nfc_leido ? "Sí" : "No", "Resultado": i.todo_ok ? "OK" : "Con fallas" };
      textos.forEach(t => { const r = (i.resultados || []).find(x => x.texto === t); fila[t] = r ? (r.ok ? "OK" : "No OK") : "—"; });
      fila["Observaciones"] = i.observaciones || "";
      fila["GPS"] = i.lat != null ? `${(+i.lat).toFixed(6)}, ${(+i.lng).toFixed(6)}` : "";
      fila["Foto 1"] = (i.fotos || [])[0] ? (links[i.fotos[0]] || i.fotos[0]) : "";
      fila["Foto 2"] = (i.fotos || [])[1] ? (links[i.fotos[1]] || i.fotos[1]) : "";
      return fila;
    });
    const h3 = [];
    exts.forEach(e => {
      const c = S.calcular(e);
      if (!c.activo) return;
      [["Carga", c.vencCarga, c.dCarga], ["Prueba hidráulica", c.vencPh, c.dPh]].forEach(([que, f, d]) => {
        if (d !== null && d <= 60) h3.push({ "Código": e.codigo, "Ubicación o patente": dondeEsta(e), "Sector": e.sector || "", "Qué vence": que, "Fecha de vencimiento": aFecha(f), "Días": d, "Situación": d < 0 ? "VENCIDO" : d <= (CFG.DIAS_AVISO || 30) ? "PRÓXIMO A VENCER" : "Vence en 60 días" });
      });
    });
    h3.sort((a, b) => a["Días"] - b["Días"]);
    const wb = XLSX.utils.book_new();
    const hoja = (rows, cols) => {
      const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [Object.fromEntries(cols.map(c => [c, ""]))], { cellDates: true, dateNF: "dd/mm/yyyy" });
      const keys = rows.length ? Object.keys(rows[0]) : cols;
      ws["!cols"] = keys.map(k => ({ wch: Math.min(45, Math.max(k.length + 2, 12)) }));
      return ws;
    };
    XLSX.utils.book_append_sheet(wb, hoja(h1, ["Código"]), "Extintores");
    XLSX.utils.book_append_sheet(wb, hoja(h2, ["Fecha", "Código"]), "Inspecciones");
    XLSX.utils.book_append_sheet(wb, hoja(h3, ["Código", "Qué vence"]), "Vencimientos");
    XLSX.writeFile(wb, `extintores_${S.hoyStr()}.xlsx`, { cellDates: true });
  }

  /* ---------------- arranque ---------------- */
  let tRe;
  S.on(() => {
    pintarSync();
    clearTimeout(tRe);
    tRe = setTimeout(async () => {
      await cargar();
      if (vistaViva && !hayModal() && document.activeElement?.id !== "buscar") render();
    }, 250);
  });
  window.addEventListener("hashchange", render);
  window.addEventListener("recuperar-clave", () => modal({
    titulo: "Nueva contraseña",
    cuerpo: `<label class="campo"><span>Nueva contraseña (mínimo 8)</span><input type="password" id="rc-clave" autocomplete="new-password"></label>`,
    acciones: [{ txt: "Guardar", clase: "prim", fn: async el => { const v = $("#rc-clave", el).value; if (v.length < 8) throw new Error("Mínimo 8 caracteres"); await S.cambiarClave(v); toast("Contraseña actualizada. Ingresá con la nueva."); } }]
  }));
  window.addEventListener("usuario-inactivo", async () => { await S.logout(); toast("Tu usuario fue dado de baja", 5000); render(); });

  (async function iniciar() {
    try {
      await S.init();
      if (S.perfil) await cargar();
      render();
    } catch (e) {
      $("#app").innerHTML = `<div class="login"><h1>No se pudo iniciar</h1><p class="error">${esc(e.message || e)}</p><button class="btn prim" onclick="location.reload()">Reintentar</button></div>`;
    }
  })();
})();
