/* =====================================================================
   store.js — Datos locales (IndexedDB), cola offline y sincronización
   con Supabase. Si no hay configuración, funciona en MODO DEMO.
   ===================================================================== */
(function () {
  "use strict";

  const CFG = window.APP_CONFIG || {};
  const DEMO = !CFG.SUPABASE_URL || !CFG.SUPABASE_ANON_KEY;
  const TABLAS = ["ubicaciones", "vehiculos", "extintores", "checklist_items", "perfiles"];
  const STORES = [...TABLAS, "inspecciones"];

  /* ---------------- utilidades ---------------- */
  const uuid = () =>
    (crypto.randomUUID ? crypto.randomUUID() :
      "10000000-1000-4000-8000-100000000000".replace(/[018]/g, c =>
        (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16)));
  const ahoraISO = () => new Date().toISOString();
  const limpiar = row => {
    const r = {};
    for (const k in row) if (!k.startsWith("_")) r[k] = row[k];
    return r;
  };

  /* ---------------- IndexedDB mínima ---------------- */
  let _db;
  function abrir() {
    if (_db) return Promise.resolve(_db);
    return new Promise((res, rej) => {
      const req = indexedDB.open("extintores-app", 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        STORES.forEach(s => db.objectStoreNames.contains(s) || db.createObjectStore(s, { keyPath: "id" }));
        db.objectStoreNames.contains("outbox") || db.createObjectStore("outbox", { keyPath: "seq", autoIncrement: true });
        db.objectStoreNames.contains("fotos") || db.createObjectStore("fotos");
        db.objectStoreNames.contains("meta") || db.createObjectStore("meta");
      };
      req.onsuccess = () => { _db = req.result; res(_db); };
      req.onerror = () => rej(req.error);
    });
  }
  async function tx(store, modo, fn) {
    const db = await abrir();
    return new Promise((res, rej) => {
      const t = db.transaction(store, modo);
      const os = t.objectStore(store);
      let out;
      Promise.resolve(fn(os)).then(v => { out = v; });
      t.oncomplete = () => res(out);
      t.onerror = () => rej(t.error);
      t.onabort = () => rej(t.error);
    });
  }
  const req2p = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const idbAll = s => tx(s, "readonly", os => req2p(os.getAll()));
  const idbGet = (s, k) => tx(s, "readonly", os => req2p(os.get(k)));
  const idbPut = (s, v, k) => tx(s, "readwrite", os => { k === undefined ? os.put(v) : os.put(v, k); });
  const idbDel = (s, k) => tx(s, "readwrite", os => { os.delete(k); });
  const idbClear = s => tx(s, "readwrite", os => { os.clear(); });
  const idbPutMany = (s, arr) => tx(s, "readwrite", os => { arr.forEach(v => os.put(v)); });
  const meta = {
    get: k => idbGet("meta", k),
    set: (k, v) => idbPut("meta", v, k)
  };

  /* ---------------- eventos ---------------- */
  const oyentes = new Set();
  const estado = { online: navigator.onLine, sincronizando: false, pendientes: 0, errores: 0, ultimaSync: null, mensaje: "" };
  function emitir() { oyentes.forEach(fn => { try { fn(estado); } catch (e) { console.error(e); } }); }

  async function contarPendientes() {
    const ob = await idbAll("outbox");
    estado.pendientes = ob.length;
    estado.errores = ob.filter(o => o.error).length;
  }

  /* ---------------- fechas y semáforo ---------------- */
  const hoyStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  function sumarMeses(fecha, meses) {
    if (!fecha) return null;
    const [y, m, d] = fecha.slice(0, 10).split("-").map(Number);
    const ultimo = new Date(Date.UTC(y, m - 1 + meses + 1, 0)).getUTCDate();
    const r = new Date(Date.UTC(y, m - 1 + meses, Math.min(d, ultimo)));
    return r.toISOString().slice(0, 10);
  }
  function diasEntre(a, b) { // b - a, ambos 'YYYY-MM-DD'
    const p = s => { const [y, m, d] = s.split("-").map(Number); return Date.UTC(y, m - 1, d); };
    return Math.round((p(b) - p(a)) / 864e5);
  }
  function calcular(ext) {
    const aviso = Number(CFG.DIAS_AVISO || 30);
    const vencCarga = sumarMeses(ext.ultima_recarga, Number(ext.meses_recarga || 12));
    const vencPh = sumarMeses(ext.ultima_ph, Number(ext.meses_ph || 60));
    const hoy = hoyStr();
    const dCarga = vencCarga ? diasEntre(hoy, vencCarga) : null;
    const dPh = vencPh ? diasEntre(hoy, vencPh) : null;
    const lista = [dCarga, dPh].filter(v => v !== null);
    const dias = lista.length ? Math.min(...lista) : null;
    let venc = "sin_datos";
    if (dias !== null) venc = dias < 0 ? "vencido" : dias <= aviso ? "proximo" : "vigente";
    const frec = Number(ext.frecuencia_dias || 30);
    const diasDesdeInsp = ext.ultima_inspeccion ? Math.floor((Date.now() - new Date(ext.ultima_inspeccion).getTime()) / 864e5) : null;
    const atrasada = diasDesdeInsp === null || diasDesdeInsp > frec;
    const proxInsp = ext.ultima_inspeccion ? Math.max(0, frec - diasDesdeInsp) : 0;
    const activo = (ext.estado || "Activo") === "Activo";
    let nivel = "verde";
    if (!activo) nivel = "gris";
    else if (venc === "vencido" || ext.observado) nivel = "rojo";
    else if (venc === "proximo" || atrasada || venc === "sin_datos") nivel = "amarillo";
    return { vencCarga, vencPh, dCarga, dPh, dias, venc, atrasada, diasDesdeInsp, proxInsp, observado: !!ext.observado, activo, nivel };
  }

  /* ---------------- Supabase ---------------- */
  let sb = null;
  if (!DEMO && window.supabase) {
    sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
  }

  async function traerTodo(tabla, filtro) {
    const paso = 1000;
    let desde = 0, out = [];
    for (;;) {
      let q = sb.from(tabla).select("*");
      if (filtro) q = filtro(q);
      const { data, error } = await q.range(desde, desde + paso - 1);
      if (error) throw error;
      out = out.concat(data || []);
      if (!data || data.length < paso) break;
      desde += paso;
    }
    return out;
  }

  const esErrorDeRed = e => !navigator.onLine || /fetch|network|Failed to fetch|NetworkError|timeout/i.test(String(e && (e.message || e)));

  async function procesar(op) {
    if (op.op === "upsert") {
      const { error } = await sb.from(op.tabla).upsert(limpiar(op.row));
      if (error) throw error;
    } else if (op.op === "update") {
      const { error } = await sb.from(op.tabla).update(op.cambios).eq("id", op.id);
      if (error) throw error;
    } else if (op.op === "inspeccion") {
      const insp = await idbGet("inspecciones", op.id);
      if (!insp) return;
      for (const ruta of insp.fotos || []) {
        const blob = await idbGet("fotos", ruta);
        if (!blob) continue;
        const { error } = await sb.storage.from("fotos").upload(ruta, blob, { upsert: true, contentType: "image/jpeg" });
        if (error && !/exists/i.test(error.message)) throw error;
      }
      const { error } = await sb.from("inspecciones").upsert(limpiar(insp));
      if (error) throw error;
      insp._pendiente = false;
      await idbPut("inspecciones", insp);
      for (const ruta of insp.fotos || []) await idbDel("fotos", ruta);
    }
  }

  async function vaciarCola() {
    const cola = (await idbAll("outbox")).sort((a, b) => a.seq - b.seq);
    for (const op of cola) {
      try {
        await procesar(op);
        await idbDel("outbox", op.seq);
      } catch (e) {
        if (esErrorDeRed(e)) throw e;
        op.error = e.message || String(e);
        op.intentos = (op.intentos || 0) + 1;
        await idbPut("outbox", op);
      }
    }
  }

  async function bajar() {
    const cola = await idbAll("outbox");
    for (const t of TABLAS) {
      const filas = await traerTodo(t);
      await idbClear(t);
      await idbPutMany(t, filas);
    }
    const desde = new Date(Date.now() - 400 * 864e5).toISOString();
    const insp = await traerTodo("inspecciones", q => q.gte("fecha", desde).order("fecha", { ascending: false }));
    const pendLocales = (await idbAll("inspecciones")).filter(i => i._pendiente);
    await idbClear("inspecciones");
    await idbPutMany("inspecciones", insp);
    await idbPutMany("inspecciones", pendLocales);
    // reaplicar cambios locales que no se pudieron subir
    for (const op of cola) {
      if (op.op === "upsert") await idbPut(op.tabla, op.row);
      if (op.op === "update") {
        const r = await idbGet(op.tabla, op.id);
        if (r) await idbPut(op.tabla, Object.assign(r, op.cambios));
      }
    }
    for (const i of pendLocales) await aplicarInspeccionLocal(i);
  }

  async function aplicarInspeccionLocal(insp) {
    const ext = await idbGet("extintores", insp.extintor_id);
    if (!ext) return;
    if (!ext.ultima_inspeccion || insp.fecha >= ext.ultima_inspeccion) {
      ext.ultima_inspeccion = insp.fecha;
      ext.observado = !insp.todo_ok;
      await idbPut("extintores", ext);
    }
  }

  let timerSync = null;
  function programarSync(ms = 800) {
    clearTimeout(timerSync);
    timerSync = setTimeout(() => Store.sync(), ms);
  }

  /* ---------------- datos de demostración ---------------- */
  function fechaRel(dias) {
    const d = new Date(Date.now() + dias * 864e5);
    return d.toISOString().slice(0, 10);
  }
  async function sembrarDemo() {
    if (await meta.get("demoSembrado")) return;
    const u = { bn: uuid(), bs: uuid(), tc: uuid() };
    await idbPutMany("ubicaciones", [
      { id: u.bn, nombre: "Base Norte", tipo: "Base", direccion: "Ruta 7 km 1200", lat: -38.9516, lng: -68.0591, activo: true },
      { id: u.bs, nombre: "Base Sur", tipo: "Base", direccion: "Parque industrial, lote 14", lat: -39.0333, lng: -67.5833, activo: true },
      { id: u.tc, nombre: "Taller Central", tipo: "Taller", direccion: "Av. Principal 2450", lat: -38.9700, lng: -68.1200, activo: true }
    ]);
    const v = { p1: uuid(), p2: uuid(), t1: uuid() };
    await idbPutMany("vehiculos", [
      { id: v.p1, patente: "AB123CD", tipo: "Pickup", descripcion: "Pickup supervisión", base_id: u.bn, activo: true },
      { id: v.p2, patente: "AC456EF", tipo: "Pickup", descripcion: "Pickup mantenimiento", base_id: u.bs, activo: true },
      { id: v.t1, patente: "AE789GH", tipo: "Trailer", descripcion: "Trailer vestuario", base_id: u.bn, activo: true }
    ]);
    const base = (o) => Object.assign({ id: uuid(), fecha_fabricacion: "2021-06-15", meses_recarga: 12, meses_ph: 60, frecuencia_dias: 30, estado: "Activo", observado: false, marca: "", serie: "" }, o);
    await idbPutMany("extintores", [
      base({ codigo: "EXT-001", serie: "A10234", agente: "ABC (polvo)", capacidad_kg: 10, ultima_recarga: fechaRel(-200), ultima_ph: fechaRel(-700), tipo_ubicacion: "Base", ubicacion_id: u.bn, sector: "Depósito", ultima_inspeccion: new Date(Date.now() - 5 * 864e5).toISOString() }),
      base({ codigo: "EXT-002", serie: "A10235", agente: "ABC (polvo)", capacidad_kg: 10, ultima_recarga: fechaRel(-350), ultima_ph: fechaRel(-900), tipo_ubicacion: "Base", ubicacion_id: u.bn, sector: "Oficinas", ultima_inspeccion: new Date(Date.now() - 12 * 864e5).toISOString() }),
      base({ codigo: "EXT-003", serie: "C55012", agente: "CO2", capacidad_kg: 5, ultima_recarga: fechaRel(-380), ultima_ph: fechaRel(-1000), tipo_ubicacion: "Taller", ubicacion_id: u.tc, sector: "Tablero eléctrico", ultima_inspeccion: new Date(Date.now() - 20 * 864e5).toISOString() }),
      base({ codigo: "EXT-004", serie: "A20011", agente: "ABC (polvo)", capacidad_kg: 5, ultima_recarga: fechaRel(-100), ultima_ph: fechaRel(-1810), tipo_ubicacion: "Pickup", vehiculo_id: v.p1, sector: "Cabina", frecuencia_dias: 15, ultima_inspeccion: new Date(Date.now() - 3 * 864e5).toISOString() }),
      base({ codigo: "EXT-005", serie: "A20012", agente: "ABC (polvo)", capacidad_kg: 5, ultima_recarga: fechaRel(-60), ultima_ph: fechaRel(-400), tipo_ubicacion: "Pickup", vehiculo_id: v.p2, sector: "Caja", frecuencia_dias: 15, ultima_inspeccion: new Date(Date.now() - 25 * 864e5).toISOString() }),
      base({ codigo: "EXT-006", serie: "A30400", agente: "ABC (polvo)", capacidad_kg: 10, ultima_recarga: fechaRel(-30), ultima_ph: fechaRel(-300), tipo_ubicacion: "Trailer", vehiculo_id: v.t1, sector: "Ingreso", observado: true, ultima_inspeccion: new Date(Date.now() - 2 * 864e5).toISOString() }),
      base({ codigo: "EXT-007", serie: "A10240", agente: "ABC (polvo)", capacidad_kg: 10, ultima_recarga: fechaRel(-90), ultima_ph: fechaRel(-500), tipo_ubicacion: "Base", ubicacion_id: u.bs, sector: "Comedor", ultima_inspeccion: new Date(Date.now() - 8 * 864e5).toISOString() }),
      base({ codigo: "EXT-008", serie: "K00077", agente: "Clase K", capacidad_kg: 6, ultima_recarga: fechaRel(-20), ultima_ph: fechaRel(-200), tipo_ubicacion: "Base", ubicacion_id: u.bs, sector: "Cocina", estado: "En recarga" })
    ]);
    const items = [
      ["Ubicado en su lugar asignado y con acceso libre", null],
      ["Señalización visible y en buen estado", null],
      ["Manómetro en zona verde", "excepto:CO2"],
      ["Precinto y pasador de seguridad colocados", null],
      ["Manguera y boquilla sin cortes, fisuras ni obstrucciones", null],
      ["Cilindro sin golpes, corrosión ni pintura deteriorada", null],
      ["Tarjeta de recarga legible y vigente", null],
      ["Soporte o sujeción firme (en vehículos: anclado y sin juego)", null],
      ["Peso correcto", "solo:CO2"]
    ];
    await idbPutMany("checklist_items", items.map(([texto, aplica], i) => ({ id: uuid(), orden: i + 1, texto, aplica, activo: true })));
    await idbPutMany("perfiles", [
      { id: "demo-seguridad", nombre: "Seguridad (demo)", email: "seguridad@demo", rol: "seguridad", activo: true, recibe_alarmas: true },
      { id: "demo-operador", nombre: "Operador (demo)", email: "operador@demo", rol: "operador", activo: true, recibe_alarmas: false }
    ]);
    await meta.set("demoSembrado", true);
  }

  /* ---------------- API pública ---------------- */
  const Store = {
    DEMO, uuid, calcular, sumarMeses, hoyStr, estado,
    usuario: null,   // {id, email}
    perfil: null,    // fila de perfiles
    get sb() { return sb; },

    on(fn) { oyentes.add(fn); return () => oyentes.delete(fn); },

    async init() {
      await abrir();
      window.addEventListener("online", () => { estado.online = true; emitir(); programarSync(300); });
      window.addEventListener("offline", () => { estado.online = false; emitir(); });
      estado.ultimaSync = await meta.get("ultimaSync") || null;
      await contarPendientes();
      if (DEMO) {
        await sembrarDemo();
        const p = await meta.get("perfil");
        if (p) { this.perfil = p; this.usuario = { id: p.id, email: p.email }; }
        return;
      }
      if (!sb) throw new Error("No se pudo cargar Supabase. Revisá la conexión la primera vez que abrís la app.");
      sb.auth.onAuthStateChange((ev) => {
        if (ev === "PASSWORD_RECOVERY") window.dispatchEvent(new CustomEvent("recuperar-clave"));
      });
      const { data } = await sb.auth.getSession();
      const p = await meta.get("perfil");
      if (data.session && p && p.id === data.session.user.id) {
        this.usuario = { id: data.session.user.id, email: data.session.user.email };
        this.perfil = p;
        setInterval(() => this.sync(), 2 * 60 * 1000);
        programarSync(500);
      }
    },

    async login(email, clave) {
      const { data, error } = await sb.auth.signInWithPassword({ email: email.trim(), password: clave });
      if (error) throw new Error(error.message === "Invalid login credentials" ? "Mail o contraseña incorrectos" : error.message);
      const { data: perfil, error: e2 } = await sb.from("perfiles").select("*").eq("id", data.user.id).maybeSingle();
      if (e2) throw e2;
      if (!perfil || !perfil.activo) {
        await sb.auth.signOut();
        throw new Error("Tu usuario todavía no fue activado por Seguridad.");
      }
      this.usuario = { id: data.user.id, email: data.user.email };
      this.perfil = perfil;
      await meta.set("perfil", perfil);
      await this.sync(true);
      setInterval(() => this.sync(), 2 * 60 * 1000);
    },

    async loginDemo(rol) {
      const p = await idbGet("perfiles", rol === "seguridad" ? "demo-seguridad" : "demo-operador");
      this.perfil = p;
      this.usuario = { id: p.id, email: p.email };
      await meta.set("perfil", p);
    },

    async logout() {
      if (!DEMO) {
        try { await sb.auth.signOut(); } catch (e) { /* offline */ }
        for (const s of [...STORES, "outbox", "fotos"]) await idbClear(s);
      }
      await meta.set("perfil", null);
      this.perfil = null; this.usuario = null;
      await contarPendientes(); emitir();
    },

    async recuperarClave(email) {
      const { error } = await sb.auth.resetPasswordForEmail(email.trim(), { redirectTo: location.origin + location.pathname });
      if (error) throw error;
    },
    async cambiarClave(nueva) {
      const { error } = await sb.auth.updateUser({ password: nueva });
      if (error) throw error;
    },

    esSeguridad() { return !!this.perfil && this.perfil.rol === "seguridad"; },

    all: s => idbAll(s),
    get: (s, id) => idbGet(s, id),

    async save(tabla, row) {
      row = Object.assign({}, row);
      if (!row.id) row.id = uuid();
      row.updated_at = ahoraISO();
      await idbPut(tabla, row);
      if (!DEMO) { await idbPut("outbox", { op: "upsert", tabla, row: limpiar(row), creado: ahoraISO() }); programarSync(); }
      await contarPendientes(); emitir();
      return row;
    },

    async update(tabla, id, cambios) {
      const r = await idbGet(tabla, id);
      if (r) await idbPut(tabla, Object.assign(r, cambios));
      if (!DEMO) { await idbPut("outbox", { op: "update", tabla, id, cambios, creado: ahoraISO() }); programarSync(); }
      await contarPendientes(); emitir();
    },

    async guardarInspeccion(insp, blobs) {
      insp.id = insp.id || uuid();
      insp.fotos = [];
      for (let i = 0; i < blobs.length; i++) {
        const ruta = `${insp.extintor_id}/${insp.id}-${i + 1}.jpg`;
        await idbPut("fotos", blobs[i], ruta);
        insp.fotos.push(ruta);
      }
      insp._pendiente = !DEMO;
      await idbPut("inspecciones", insp);
      await aplicarInspeccionLocal(insp);
      if (!DEMO) { await idbPut("outbox", { op: "inspeccion", id: insp.id, creado: ahoraISO() }); programarSync(); }
      await contarPendientes(); emitir();
      return insp;
    },

    async urlFoto(ruta) {
      const blob = await idbGet("fotos", ruta);
      if (blob) return URL.createObjectURL(blob);
      if (DEMO || !navigator.onLine) return null;
      const cache = Store._urls || (Store._urls = {});
      if (cache[ruta] && cache[ruta].exp > Date.now()) return cache[ruta].url;
      const { data, error } = await sb.storage.from("fotos").createSignedUrl(ruta, 3600);
      if (error) return null;
      cache[ruta] = { url: data.signedUrl, exp: Date.now() + 50 * 60 * 1000 };
      return data.signedUrl;
    },

    async crearUsuario({ nombre, email, clave, rol }) {
      if (DEMO) {
        const p = { id: uuid(), nombre, email, rol, activo: true, recibe_alarmas: rol === "seguridad" };
        await idbPut("perfiles", p); emitir(); return p;
      }
      if (!navigator.onLine) throw new Error("Para crear usuarios hace falta conexión.");
      const temp = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY, {
        auth: { persistSession: false, autoRefreshToken: false, storageKey: "alta-temporal" }
      });
      const { data, error } = await temp.auth.signUp({ email: email.trim(), password: clave, options: { data: { nombre } } });
      if (error) throw error;
      if (!data.user || !data.user.id) throw new Error("No se pudo crear el usuario.");
      if (data.user.identities && data.user.identities.length === 0) throw new Error("Ese mail ya tiene un usuario. Activalo desde la lista.");
      // esperar a que el trigger cree el perfil
      for (let i = 0; i < 5; i++) {
        const { data: upd, error: e2 } = await sb.from("perfiles").update({ nombre, rol, activo: true, recibe_alarmas: rol === "seguridad" }).eq("id", data.user.id).select();
        if (e2) throw e2;
        if (upd && upd.length) break;
        await new Promise(r => setTimeout(r, 700));
      }
      await this.sync(true);
      return data.user;
    },

    async sync(forzar) {
      if (DEMO || !sb || !this.usuario) return;
      if (estado.sincronizando) return;
      if (!navigator.onLine) { estado.online = false; emitir(); return; }
      estado.sincronizando = true; estado.mensaje = ""; emitir();
      try {
        await vaciarCola();
        await bajar();
        // refrescar perfil propio (por si lo dieron de baja o cambió el rol)
        const yo = await idbGet("perfiles", this.usuario.id);
        if (yo) {
          this.perfil = yo; await meta.set("perfil", yo);
          if (!yo.activo) { window.dispatchEvent(new CustomEvent("usuario-inactivo")); }
        }
        estado.ultimaSync = ahoraISO();
        await meta.set("ultimaSync", estado.ultimaSync);
        estado.online = true;
      } catch (e) {
        console.warn("sync", e);
        estado.mensaje = esErrorDeRed(e) ? "Sin conexión" : (e.message || String(e));
        if (/JWT|token|401/i.test(estado.mensaje)) estado.mensaje = "Sesión vencida: volvé a ingresar";
      } finally {
        estado.sincronizando = false;
        await contarPendientes();
        emitir();
      }
    },

    async erroresCola() { return (await idbAll("outbox")).filter(o => o.error); },
    async descartarError(seq) { await idbDel("outbox", seq); await contarPendientes(); emitir(); }
  };

  window.Store = Store;
})();
