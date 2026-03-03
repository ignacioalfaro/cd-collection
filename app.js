/* =========================
   CD Collection - app.js
   Local (localStorage) + Import/Export + CSV + GitHub Sync (optional)
   ========================= */

/* ====== Storage (local) ====== */
const KEY = "cd_collection_v1";

function loadItems() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}
function saveItems(items) {
  localStorage.setItem(KEY, JSON.stringify(items));
}

/* ====== Utilities ====== */
function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}
function esc(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
function ytFallback(it) {
  const q = encodeURIComponent(`${it.artist || ""} ${it.album || ""}`.trim());
  return `https://music.youtube.com/search?q=${q}`;
}
function byId(id) { return document.getElementById(id); }
function on(id, ev, fn) {
  const el = byId(id);
  if (el) el.addEventListener(ev, fn);
}

/* ====== State ====== */
let ITEMS = loadItems();

/* ====== Elements ====== */
const tabs = [...document.querySelectorAll(".tab")];
const pages = {
  home: byId("page-home"),
  lib: byId("page-lib"),
  random: byId("page-random"),
};

const libGrid = byId("libGrid");
const qEl = byId("q");
const fEstadoEl = byId("fEstado");
const fDiscogsEl = byId("fDiscogs");

const modal = byId("modal");
const modalTitle = byId("modalTitle");
const modalBody = byId("modalBody");
const btnClose = byId("btnClose");

const randomBox = byId("randomBox");

/* ====== Navigation ====== */
function showPage(name) {
  Object.entries(pages).forEach(([k, el]) => {
    if (!el) return;
    el.classList.toggle("hidden", k !== name);
  });
  tabs.forEach(t => t.classList.toggle("active", t.dataset.page === name));
}
tabs.forEach(t => t.addEventListener("click", () => showPage(t.dataset.page)));
document.querySelectorAll("[data-nav]").forEach(b => {
  b.addEventListener("click", () => showPage(b.dataset.nav));
});

/* ====== Modal ====== */
function openModal(title, html) {
  if (!modal || !modalTitle || !modalBody) return;
  modalTitle.textContent = title;
  modalBody.innerHTML = html;
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
}
function closeModal() {
  if (!modal) return;
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
}
if (btnClose) btnClose.addEventListener("click", closeModal);
if (modal) {
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });
}

/* ====== Normalization ====== */
function normalizeItem(x) {
  return {
    id: x.id || uid(),
    artist: x.artist || x.interprete || "",
    album: x.album || "",
    city: x.city || x.ciudad || "",
    store: x.store || x.tienda || "",
    price: x.price || x.precio || "",
    date: x.date || x.fecha || "",
    state: x.state || x.estado || "Nuevo",
    discogs: !!(x.discogs ?? x.registradoEnDiscogs ?? x.discogs === true),
    notes: x.notes || x.obs || x.observacion || "",
    youtube: x.youtube || x.yt || "",
    image: x.image || x.img || "",
    createdAt: x.createdAt || Date.now(),
    updatedAt: x.updatedAt || Date.now(),
  };
}

/* ====== Rendering ====== */
function cardHTML(it) {
  const img = it.image
    ? `<img src="${esc(it.image)}" alt="">`
    : `<div style="font-size:40px;opacity:.85">💿</div>`;

  const chips = [
    it.state ? `<span class="chip">${it.state === "Nuevo" ? "🆕" : "♻️"} ${esc(it.state)}</span>` : "",
    `<span class="chip">✅ Discogs: ${it.discogs ? "Sí" : "No"}</span>`
  ].join("");

  return `
    <div class="card" data-id="${esc(it.id)}">
      <div class="cover">${img}</div>
      <div class="meta">
        <div class="album">${esc(it.album || "—")}</div>
        <div class="artist">${esc(it.artist || "—")}</div>
        <div class="chips">${chips}</div>
      </div>
    </div>
  `;
}

function renderLib() {
  if (!libGrid) return;

  const q = (qEl?.value || "").trim().toLowerCase();
  const fEstado = fEstadoEl?.value || "";
  const fDiscogs = fDiscogsEl?.value ?? "";

  let list = [...ITEMS];

  if (q) {
    list = list.filter(it =>
      (it.album || "").toLowerCase().includes(q) ||
      (it.artist || "").toLowerCase().includes(q)
    );
  }
  if (fEstado) list = list.filter(it => (it.state || "") === fEstado);
  if (fDiscogs !== "") {
    const want = fDiscogs === "1";
    list = list.filter(it => !!it.discogs === want);
  }

  libGrid.innerHTML = list.map(cardHTML).join("") || `<div class="muted">No hay resultados.</div>`;

  libGrid.querySelectorAll(".card").forEach(c => {
    c.addEventListener("click", () => openDetail(c.dataset.id));
  });
}

function renderHome() {
  const total = ITEMS.length;
  const discogsCount = ITEMS.filter(x => x.discogs).length;
  const nuevo = ITEMS.filter(x => x.state === "Nuevo").length;
  const usado = ITEMS.filter(x => x.state === "Usado").length;

  const kTotal = byId("kTotal");
  const kDiscogs = byId("kDiscogs");
  const kNuevo = byId("kNuevo");
  const kUsado = byId("kUsado");

  if (kTotal) kTotal.textContent = total;
  if (kDiscogs) kDiscogs.textContent = total ? `${discogsCount} (${Math.round((discogsCount / total) * 100)}%)` : "0 (0%)";
  if (kNuevo) kNuevo.textContent = nuevo;
  if (kUsado) kUsado.textContent = usado;

  // Top artistas
  const counts = new Map();
  for (const it of ITEMS) {
    const k = (it.artist || "").trim();
    if (!k) continue;
    counts.set(k, (counts.get(k) || 0) + 1);
  }
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const box = byId("topArtists");
  if (box) {
    box.innerHTML = top.length
      ? top.map(([artist, count]) => `<div class="row"><div>🎤 ${esc(artist)}</div><div style="font-weight:1000">${count}</div></div>`).join("")
      : `<div class="muted">Cargá CDs para ver el ranking.</div>`;
  }
}

function refresh() {
  saveItems(ITEMS);
  renderHome();
  renderLib();
}

/* ====== Detail / Edit ====== */
function openDetail(id) {
  const it = ITEMS.find(x => x.id === id);
  if (!it) return;

  const yt = it.youtube || ytFallback(it);
  const img = it.image
    ? `<img src="${esc(it.image)}" style="width:120px;height:120px;object-fit:cover;">`
    : `<div style="font-size:44px;opacity:.85">💿</div>`;
  const date = it.date || "—";

  openModal(`📀 ${it.album || "CD"}`, `
    <div class="detail">
      <div class="cover">${img}</div>
      <div>
        <div class="h1">${esc(it.album || "—")}</div>
        <div class="muted">${esc(it.artist || "—")}</div>
        <div class="chips" style="margin-top:10px;">
          <span class="chip">🗓️ ${esc(date)}</span>
          <span class="chip">${it.state === "Nuevo" ? "🆕" : "♻️"} ${esc(it.state || "—")}</span>
          <span class="chip">✅ Discogs: ${it.discogs ? "Sí" : "No"}</span>
        </div>
      </div>
    </div>

    ${it.notes ? `<div class="panel" style="margin-top:12px;"><div class="muted" style="margin-bottom:6px;">Notas</div>${esc(it.notes)}</div>` : ""}

    <div class="actions" style="margin-top:12px;">
      <a class="btn" href="${esc(yt)}" target="_blank" rel="noopener">▶️ YouTube Music</a>
      <button class="btn ghost" id="btnEdit">✏️ Editar</button>
      <button class="btn danger" id="btnDel">🗑️ Borrar</button>
    </div>
  `);

  byId("btnEdit")?.addEventListener("click", () => openEdit(it.id));
  byId("btnDel")?.addEventListener("click", () => delItem(it.id));
}

function openEdit(id) {
  const existing = id ? ITEMS.find(x => x.id === id) : null;
  const it = existing || {
    id: uid(),
    artist: "",
    album: "",
    city: "",
    store: "",
    price: "",
    date: "",
    state: "Nuevo",
    discogs: false,
    notes: "",
    youtube: "",
    image: ""
  };

  openModal(existing ? "✏️ Editar" : "➕ Agregar", `
    <div class="formgrid">
      <div class="field">
        <label>Artista</label>
        <input id="e_artist" value="${esc(it.artist)}" />
      </div>
      <div class="field">
        <label>Álbum</label>
        <input id="e_album" value="${esc(it.album)}" />
      </div>

      <div class="field">
        <label>Ciudad</label>
        <input id="e_city" value="${esc(it.city)}" />
      </div>
      <div class="field">
        <label>Tienda</label>
        <input id="e_store" value="${esc(it.store)}" />
      </div>

      <div class="field">
        <label>Precio (USD)</label>
        <input id="e_price" value="${esc(it.price)}" />
      </div>
      <div class="field">
        <label>Fecha compra</label>
        <input id="e_date" type="date" value="${esc(it.date)}" />
      </div>

      <div class="field">
        <label>Estado</label>
        <select id="e_state">
          <option ${it.state === "Nuevo" ? "selected" : ""}>Nuevo</option>
          <option ${it.state === "Usado" ? "selected" : ""}>Usado</option>
        </select>
      </div>
      <div class="field">
        <label>Discogs</label>
        <select id="e_discogs">
          <option value="0" ${!it.discogs ? "selected" : ""}>No</option>
          <option value="1" ${it.discogs ? "selected" : ""}>Sí</option>
        </select>
      </div>

      <div class="field full">
        <label>Observación</label>
        <textarea id="e_notes" rows="3" placeholder="Notas...">${esc(it.notes)}</textarea>
      </div>

      <div class="field full">
        <label>YouTube Music Link (opcional)</label>
        <input id="e_youtube" value="${esc(it.youtube)}" placeholder="si lo dejás vacío, se genera búsqueda" />
      </div>

      <div class="field full">
        <label>Imagen URL (opcional)</label>
        <input id="e_image" value="${esc(it.image)}" placeholder="link público a la tapa (jpg/png)" />
      </div>
    </div>

    <div class="actions" style="margin-top:14px;">
      <button class="btn" id="btnSave">💾 Guardar</button>
      <button class="btn ghost" id="btnCancel">Cancelar</button>
    </div>
  `);

  byId("btnCancel")?.addEventListener("click", closeModal);
  byId("btnSave")?.addEventListener("click", () => {
    const payload = normalizeItem({
      id: it.id,
      artist: byId("e_artist")?.value.trim(),
      album: byId("e_album")?.value.trim(),
      city: byId("e_city")?.value.trim(),
      store: byId("e_store")?.value.trim(),
      price: byId("e_price")?.value.trim(),
      date: byId("e_date")?.value,
      state: byId("e_state")?.value,
      discogs: (byId("e_discogs")?.value === "1"),
      notes: byId("e_notes")?.value.trim(),
      youtube: byId("e_youtube")?.value.trim(),
      image: byId("e_image")?.value.trim(),
      updatedAt: Date.now(),
      createdAt: existing?.createdAt ?? Date.now(),
    });

    if (!payload.artist && !payload.album) {
      alert("Poné al menos Artista o Álbum.");
      return;
    }

    if (existing) {
      const idx = ITEMS.findIndex(x => x.id === it.id);
      ITEMS[idx] = payload;
    } else {
      ITEMS.unshift(payload);
    }

    closeModal();
    refresh();
    scheduleAutoPush(); // autosync
  });
}

function delItem(id) {
  if (!confirm("¿Borrar este CD?")) return;
  ITEMS = ITEMS.filter(x => x.id !== id);
  closeModal();
  refresh();
  scheduleAutoPush(); // autosync
}

/* ====== Random ====== */
function pickRandom() {
  if (!ITEMS.length) return null;
  return ITEMS[Math.floor(Math.random() * ITEMS.length)];
}
function showRandom() {
  if (!randomBox) return;

  const it = pickRandom();
  if (!it) {
    randomBox.classList.remove("hidden");
    randomBox.innerHTML = `<div class="muted">No hay CDs cargados todavía.</div>`;
    return;
  }

  const yt = it.youtube || ytFallback(it);
  const img = it.image
    ? `<img src="${esc(it.image)}" style="width:120px;height:120px;object-fit:cover;">`
    : `<div style="font-size:44px;opacity:.85">💿</div>`;
  const date = it.date || "—";

  const html = `
    <div class="detail">
      <div class="cover" style="border-radius:18px;overflow:hidden;">${img}</div>
      <div>
        <div class="h1">${esc(it.album || "—")}</div>
        <div class="muted">${esc(it.artist || "—")}</div>
        <div class="chips" style="margin-top:10px;">
          <span class="chip">🗓️ ${esc(date)}</span>
          <span class="chip">${it.state === "Nuevo" ? "🆕" : "♻️"} ${esc(it.state || "—")}</span>
          <span class="chip">✅ Discogs: ${it.discogs ? "Sí" : "No"}</span>
        </div>
      </div>
    </div>

    ${it.notes ? `<div class="panel" style="margin-top:12px;"><div class="muted" style="margin-bottom:6px;">Notas</div>${esc(it.notes)}</div>` : ""}

    <div class="actions" style="margin-top:12px;">
      <a class="btn" href="${esc(yt)}" target="_blank" rel="noopener">▶️ YouTube Music</a>
      <button class="btn ghost" id="btnAnother">🔁 Otro</button>
      <button class="btn ghost" id="btnFicha">📀 Ver ficha</button>
    </div>
  `;

  randomBox.classList.remove("hidden");
  randomBox.innerHTML = html;

  byId("btnAnother")?.addEventListener("click", showRandom);
  byId("btnFicha")?.addEventListener("click", () => openDetail(it.id));

  openModal("🎲 Random CD", html);
}

/* ====== Import/Export JSON ====== */
function exportJSON() {
  const blob = new Blob([JSON.stringify(ITEMS, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "cd-collection-backup.json";
  a.click();
  URL.revokeObjectURL(url);
}
function importJSON(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!Array.isArray(data)) throw new Error("Formato inválido");
      ITEMS = data.map(normalizeItem);
      refresh();
      scheduleAutoPush();
      alert("Importado OK ✅");
    } catch {
      alert("No pude importar ese JSON.");
    }
  };
  reader.readAsText(file);
}

/* ====== CSV (Excel) Export/Import ====== */
function toCSVValue(v) {
  const s = String(v ?? "");
  const escaped = s.replaceAll('"', '""');
  return /[",\n\r]/.test(escaped) ? `"${escaped}"` : escaped;
}

function exportCSV() {
  const headers = ["artist","album","city","store","price","date","state","discogs","notes","youtube","image"];
  const lines = [headers.join(",")];

  for (const it of ITEMS) {
    const row = [
      it.artist, it.album, it.city, it.store, it.price, it.date, it.state,
      it.discogs ? "1" : "0",
      it.notes, it.youtube, it.image
    ].map(toCSVValue).join(",");
    lines.push(row);
  }

  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "cd-collection.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function parseCSV(text) {
  const rows = [];
  let row = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') { cur += '"'; i++; continue; }
      if (ch === '"') { inQuotes = false; continue; }
      cur += ch;
      continue;
    }

    if (ch === '"') { inQuotes = true; continue; }
    if (ch === ",") { row.push(cur); cur = ""; continue; }

    if (ch === "\n") {
      row.push(cur); cur = "";
      if (row.some(x => String(x).trim() !== "")) rows.push(row);
      row = [];
      continue;
    }
    if (ch === "\r") continue;
    cur += ch;
  }

  row.push(cur);
  if (row.some(x => String(x).trim() !== "")) rows.push(row);
  return rows;
}

function importCSV(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const text = String(reader.result || "");
      const rows = parseCSV(text);
      if (rows.length < 2) throw new Error("CSV vacío");

      const headers = rows[0].map(h => String(h || "").trim().toLowerCase());
      const idx = (name) => headers.indexOf(name);

      const map = {
        artist: idx("artist"),
        album: idx("album"),
        city: idx("city"),
        store: idx("store"),
        price: idx("price"),
        date: idx("date"),
        state: idx("state"),
        discogs: idx("discogs"),
        notes: idx("notes"),
        youtube: idx("youtube"),
        image: idx("image"),
      };

      // soportar headers en español
      const alt = (a, b) => map[a] !== -1 ? map[a] : idx(b);
      map.artist = alt("artist", "interprete");
      map.city = alt("city", "ciudad de compra");
      map.store = alt("store", "tienda");
      map.price = alt("price", "precio");
      map.date = alt("date", "fecha de compra");
      map.state = alt("state", "estado");
      map.notes = alt("notes", "observacion");
      map.youtube = alt("youtube", "youtube music link");
      map.image = alt("image", "imagen_url");

      const now = Date.now();
      const imported = [];

      for (let r = 1; r < rows.length; r++) {
        const line = rows[r];
        const get = (k) => {
          const i = map[k];
          return i >= 0 ? String(line[i] ?? "").trim() : "";
        };

        const discogsRaw = get("discogs").toLowerCase();
        const discogs = discogsRaw === "1" || discogsRaw === "true" || discogsRaw === "si" || discogsRaw === "sí" || discogsRaw === "x";

        const item = normalizeItem({
          id: uid(),
          artist: get("artist"),
          album: get("album"),
          city: get("city"),
          store: get("store"),
          price: get("price"),
          date: get("date"),
          state: get("state") || "Nuevo",
          discogs,
          notes: get("notes"),
          youtube: get("youtube"),
          image: get("image"),
          createdAt: now,
          updatedAt: now
        });

        if (!item.artist && !item.album) continue;
        imported.push(item);
      }

      const replace = confirm("¿Querés REEMPLAZAR tu colección con lo importado?\nOK = Reemplazar\nCancelar = Sumar");
      ITEMS = replace ? imported : imported.concat(ITEMS);

      refresh();
      scheduleAutoPush();
      alert(`Importado OK ✅ (${imported.length} CDs)`);
    } catch (e) {
      alert("No pude importar ese CSV. Revisá que tenga encabezados (artist, album, etc).");
    }
  };
  reader.readAsText(file);
}

/* ====== Seed ====== */
function seedExample() {
  if (ITEMS.length && !confirm("Esto va a agregar ejemplos. ¿Seguimos?")) return;
  const now = Date.now();
  ITEMS = [
    normalizeItem({ id: uid(), artist: "BRUNO MARS", album: "24K MAGIC", state: "Usado", discogs: true, date: "2026-02-28", city: "BUENOS AIRES", store: "PARQUE RIVADAVIA", price: "10.03", notes: "Segundo disco del artista", createdAt: now, updatedAt: now }),
    normalizeItem({ id: uid(), artist: "MICHAEL JACKSON", album: "THRILLER (40 AÑOS)", state: "Nuevo", discogs: true, date: "2026-02-16", city: "MADRID", store: "CORTE INGLÉS", price: "20.15", notes: "Primer CD de todos", createdAt: now, updatedAt: now }),
    normalizeItem({ id: uid(), artist: "CHARLY GARCIA", album: "CLICS MODERNOS", state: "Nuevo", discogs: false, date: "2026-02-24", city: "BUENOS AIRES", store: "LEF", price: "7.56", notes: "", createdAt: now, updatedAt: now }),
  ].concat(ITEMS);
  refresh();
  scheduleAutoPush();
}

/* =======================
   GitHub Sync (optional)
   ======================= */
const SYNC_KEY = "cd_sync_github_v1";
let syncCfg = loadSyncCfg();
let remoteSha = null;
let syncInFlight = false;
let syncTimer = null;

function loadSyncCfg() {
  try {
    const raw = localStorage.getItem(SYNC_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}
function saveSyncCfg(cfg) {
  localStorage.setItem(SYNC_KEY, JSON.stringify(cfg));
}
function setSyncStatus(msg) {
  const el = byId("syncStatus");
  if (el) el.textContent = msg;
}
function githubApiHeaders() {
  return {
    "Accept": "application/vnd.github+json",
    "Authorization": `Bearer ${syncCfg.token}`,
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

async function ghGetFile() {
  const url = `https://api.github.com/repos/${syncCfg.owner}/${syncCfg.repo}/contents/${syncCfg.path}?ref=${encodeURIComponent(syncCfg.branch)}`;
  const res = await fetch(url, { headers: githubApiHeaders() });
  if (res.status === 404) return { exists: false };
  if (!res.ok) throw new Error(`GitHub GET error: ${res.status}`);
  const data = await res.json();
  return { exists: true, sha: data.sha, content: data.content };
}

async function ghPutFile(jsonText, message) {
  const url = `https://api.github.com/repos/${syncCfg.owner}/${syncCfg.repo}/contents/${syncCfg.path}`;
  const body = {
    message,
    content: btoa(unescape(encodeURIComponent(jsonText))),
    branch: syncCfg.branch
  };
  if (remoteSha) body.sha = remoteSha;

  const res = await fetch(url, {
    method: "PUT",
    headers: { ...githubApiHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(`GitHub PUT error: ${res.status}`);
  const out = await res.json();
  remoteSha = out.content?.sha || remoteSha;
  return true;
}

function mergeCollections(localItems, remoteItems) {
  const map = new Map();
  for (const it of remoteItems.map(normalizeItem)) map.set(it.id, it);
  for (const it of localItems.map(normalizeItem)) {
    const prev = map.get(it.id);
    if (!prev || (it.updatedAt || 0) >= (prev.updatedAt || 0)) map.set(it.id, it);
  }
  return [...map.values()].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

async function syncPull() {
  if (!syncCfg) { setSyncStatus("⚠️ Falta configurar"); return; }
  if (syncInFlight) return;
  syncInFlight = true;
  try {
    setSyncStatus("⬇️ Trayendo de GitHub...");
    const file = await ghGetFile();
    if (!file.exists) {
      setSyncStatus("ℹ️ No existe data/cds.json (se crea al primer push)");
      return;
    }
    remoteSha = file.sha;

    const jsonText = decodeURIComponent(escape(atob(file.content.replace(/\n/g, ""))));
    const remote = JSON.parse(jsonText);
    if (!Array.isArray(remote)) throw new Error("Remote JSON no es array");

    ITEMS = mergeCollections(ITEMS, remote);
    refresh();
    setSyncStatus("✅ Traído y fusionado");
  } catch (e) {
    setSyncStatus("❌ Error pull: " + (e?.message || e));
  } finally {
    syncInFlight = false;
  }
}

async function syncPush() {
  if (!syncCfg) { setSyncStatus("⚠️ Falta configurar"); return; }
  if (syncInFlight) return;
  syncInFlight = true;
  try {
    setSyncStatus("⬆️ Subiendo a GitHub...");
    const file = await ghGetFile();
    remoteSha = file.exists ? file.sha : null;

    const payload = JSON.stringify(ITEMS.map(normalizeItem), null, 2);
    await ghPutFile(payload, "Update cd collection");
    setSyncStatus("✅ Subido");
  } catch (e) {
    setSyncStatus("❌ Error push: " + (e?.message || e));
  } finally {
    syncInFlight = false;
  }
}

async function syncNow() {
  await syncPull();
  await syncPush();
}

function scheduleAutoPush() {
  if (!syncCfg) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => syncPush(), 2000);
}

function openSyncSettings() {
  const cur = syncCfg || {
    owner: "ignacioalfaro",
    repo: "cd-collection",
    branch: "main",
    path: "data/cds.json",
    token: ""
  };

  openModal("🔑 Configurar GitHub Sync", `
    <div class="formgrid">
      <div class="field"><label>Owner</label><input id="s_owner" value="${esc(cur.owner)}"></div>
      <div class="field"><label>Repo</label><input id="s_repo" value="${esc(cur.repo)}"></div>
      <div class="field"><label>Branch</label><input id="s_branch" value="${esc(cur.branch)}"></div>
      <div class="field"><label>Path</label><input id="s_path" value="${esc(cur.path)}"></div>
      <div class="field full"><label>Token (Fine-grained)</label><input id="s_token" value="${esc(cur.token)}" placeholder="github_pat_..."></div>
      <div class="muted full">
        Permisos recomendados: Fine-grained token → Solo este repo → Contents (read & write)
      </div>
    </div>
    <div class="actions" style="margin-top:14px;">
      <button class="btn" id="btnSaveSync">💾 Guardar</button>
      <button class="btn ghost" id="btnCancelSync">Cancelar</button>
    </div>
  `);

  byId("btnCancelSync")?.addEventListener("click", closeModal);
  byId("btnSaveSync")?.addEventListener("click", async () => {
    const cfg = {
      owner: byId("s_owner")?.value.trim(),
      repo: byId("s_repo")?.value.trim(),
      branch: (byId("s_branch")?.value.trim() || "main"),
      path: (byId("s_path")?.value.trim() || "data/cds.json"),
      token: byId("s_token")?.value.trim(),
    };
    if (!cfg.owner || !cfg.repo || !cfg.token) {
      alert("Completá owner, repo y token.");
      return;
    }
    syncCfg = cfg;
    saveSyncCfg(cfg);
    closeModal();
    setSyncStatus("✅ Configurado. Sincronizando...");
    await syncNow();
  });
}

/* ====== Wire events ====== */
on("btnAdd", "click", () => openEdit(null));
on("btnAddHome", "click", () => openEdit(null));
on("btnRandom", "click", () => { showPage("random"); showRandom(); });
on("btnRandomHome", "click", () => { showPage("random"); showRandom(); });

if (qEl) qEl.addEventListener("input", renderLib);
if (fEstadoEl) fEstadoEl.addEventListener("change", renderLib);
if (fDiscogsEl) fDiscogsEl.addEventListener("change", renderLib);

on("btnExport", "click", exportJSON);
on("btnExportCSV", "click", exportCSV);
on("btnSeed", "click", seedExample);

const fileImport = byId("fileImport");
if (fileImport) {
  fileImport.addEventListener("change", (e) => {
    const f = e.target.files?.[0];
    if (f) importJSON(f);
    e.target.value = "";
  });
}
const fileImportCSV = byId("fileImportCSV");
if (fileImportCSV) {
  fileImportCSV.addEventListener("change", (e) => {
    const f = e.target.files?.[0];
    if (f) importCSV(f);
    e.target.value = "";
  });
}

/* Sync buttons (optional) */
on("btnSyncSettings", "click", openSyncSettings);
on("btnSyncPull", "click", syncPull);
on("btnSyncPush", "click", syncPush);
on("btnSyncNow", "click", syncNow);

/* ====== PWA ====== */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
}

/* ====== Boot ====== */
refresh();
showPage("home");
if (syncCfg) {
  setSyncStatus("🔄 Sincronizando...");
  syncNow();
} else {
  setSyncStatus("Sin sincronización");
}
