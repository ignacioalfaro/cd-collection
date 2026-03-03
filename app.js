/* ====== Storage ====== */
const KEY = "cd_collection_v1";

function loadItems(){
  try{
    const raw = localStorage.getItem(KEY);
    if(!raw) return [];
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  }catch{
    return [];
  }
}
function saveItems(items){
  localStorage.setItem(KEY, JSON.stringify(items));
}

/* ====== Utilities ====== */
function uid(){
  return Math.random().toString(36).slice(2,10) + Date.now().toString(36);
}
function esc(s){
  return String(s ?? "")
    .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
    .replaceAll('"',"&quot;").replaceAll("'","&#39;");
}
function ytFallback(it){
  const q = encodeURIComponent(`${it.artist||""} ${it.album||""}`.trim());
  return `https://music.youtube.com/search?q=${q}`;
}

/* ====== State ====== */
let ITEMS = loadItems();

/* ====== Elements ====== */
const tabs = [...document.querySelectorAll(".tab")];
const pages = {
  home: document.getElementById("page-home"),
  lib: document.getElementById("page-lib"),
  random: document.getElementById("page-random"),
};

const libGrid = document.getElementById("libGrid");
const qEl = document.getElementById("q");
const fEstadoEl = document.getElementById("fEstado");
const fDiscogsEl = document.getElementById("fDiscogs");

const modal = document.getElementById("modal");
const modalTitle = document.getElementById("modalTitle");
const modalBody = document.getElementById("modalBody");
const btnClose = document.getElementById("btnClose");

const randomBox = document.getElementById("randomBox");

/* ====== Navigation ====== */
function showPage(name){
  Object.entries(pages).forEach(([k,el]) => el.classList.toggle("hidden", k !== name));
  tabs.forEach(t => t.classList.toggle("active", t.dataset.page === name));
}

tabs.forEach(t => t.addEventListener("click", () => showPage(t.dataset.page)));
document.querySelectorAll("[data-nav]").forEach(b => b.addEventListener("click", () => showPage(b.dataset.nav)));

/* ====== Modal ====== */
function openModal(title, html){
  modalTitle.textContent = title;
  modalBody.innerHTML = html;
  modal.classList.add("open");
  modal.setAttribute("aria-hidden","false");
}
function closeModal(){
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden","true");
}
btnClose.addEventListener("click", closeModal);
modal.addEventListener("click", (e) => { if(e.target === modal) closeModal(); });

/* ====== Rendering ====== */
function cardHTML(it){
  const img = it.image ? `<img src="${esc(it.image)}" alt="">` : `<div style="font-size:40px;opacity:.85">💿</div>`;
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

function renderLib(){
  const q = qEl.value.trim().toLowerCase();
  const fEstado = fEstadoEl.value;
  const fDiscogs = fDiscogsEl.value;

  let list = [...ITEMS];

  if(q){
    list = list.filter(it =>
      (it.album||"").toLowerCase().includes(q) ||
      (it.artist||"").toLowerCase().includes(q)
    );
  }
  if(fEstado){
    list = list.filter(it => (it.state||"") === fEstado);
  }
  if(fDiscogs !== ""){
    const want = fDiscogs === "1";
    list = list.filter(it => !!it.discogs === want);
  }

  libGrid.innerHTML = list.map(cardHTML).join("") || `<div class="muted">No hay resultados.</div>`;

  // click handler
  libGrid.querySelectorAll(".card").forEach(c => {
    c.addEventListener("click", () => openDetail(c.dataset.id));
  });
}

function renderHome(){
  const total = ITEMS.length;
  const discogsCount = ITEMS.filter(x => x.discogs).length;
  const nuevo = ITEMS.filter(x => x.state === "Nuevo").length;
  const usado = ITEMS.filter(x => x.state === "Usado").length;

  document.getElementById("kTotal").textContent = total;
  document.getElementById("kDiscogs").textContent = total ? `${discogsCount} (${Math.round((discogsCount/total)*100)}%)` : "0 (0%)";
  document.getElementById("kNuevo").textContent = nuevo;
  document.getElementById("kUsado").textContent = usado;

  // Top artistas
  const counts = new Map();
  for(const it of ITEMS){
    const k = (it.artist || "").trim();
    if(!k) continue;
    counts.set(k, (counts.get(k) || 0) + 1);
  }
  const top = [...counts.entries()]
    .sort((a,b) => b[1]-a[1])
    .slice(0,5);

  const box = document.getElementById("topArtists");
  box.innerHTML = top.length
    ? top.map(([artist,count]) => `<div class="row"><div>🎤 ${esc(artist)}</div><div style="font-weight:1000">${count}</div></div>`).join("")
    : `<div class="muted">Cargá CDs para ver el ranking.</div>`;
}

function refresh(){
  saveItems(ITEMS);
  renderHome();
  renderLib();
}

/* ====== Detail / Edit ====== */
function openDetail(id){
  const it = ITEMS.find(x => x.id === id);
  if(!it) return;

  const yt = it.youtube || ytFallback(it);
  const img = it.image ? `<img src="${esc(it.image)}" style="width:120px;height:120px;object-fit:cover;">` : `<div style="font-size:44px;opacity:.85">💿</div>`;
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

  document.getElementById("btnEdit").addEventListener("click", () => openEdit(it.id));
  document.getElementById("btnDel").addEventListener("click", () => delItem(it.id));
}

function openEdit(id){
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
          <option ${it.state==="Nuevo"?"selected":""}>Nuevo</option>
          <option ${it.state==="Usado"?"selected":""}>Usado</option>
        </select>
      </div>
      <div class="field">
        <label>Discogs</label>
        <select id="e_discogs">
          <option value="0" ${!it.discogs?"selected":""}>No</option>
          <option value="1" ${it.discogs?"selected":""}>Sí</option>
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

  document.getElementById("btnCancel").addEventListener("click", closeModal);
  document.getElementById("btnSave").addEventListener("click", () => {
    const payload = {
      id: it.id,
      artist: document.getElementById("e_artist").value.trim(),
      album: document.getElementById("e_album").value.trim(),
      city: document.getElementById("e_city").value.trim(),
      store: document.getElementById("e_store").value.trim(),
      price: document.getElementById("e_price").value.trim(),
      date: document.getElementById("e_date").value,
      state: document.getElementById("e_state").value,
      discogs: document.getElementById("e_discogs").value === "1",
      notes: document.getElementById("e_notes").value.trim(),
      youtube: document.getElementById("e_youtube").value.trim(),
      image: document.getElementById("e_image").value.trim(),
      updatedAt: Date.now(),
      createdAt: existing?.createdAt ?? Date.now()
    };

    if(!payload.artist && !payload.album){
      alert("Poné al menos Artista o Álbum.");
      return;
    }

    if(existing){
      const idx = ITEMS.findIndex(x => x.id === it.id);
      ITEMS[idx] = payload;
    }else{
      ITEMS.unshift(payload);
    }

    closeModal();
    refresh();
  });
}

function delItem(id){
  if(!confirm("¿Borrar este CD?")) return;
  ITEMS = ITEMS.filter(x => x.id !== id);
  closeModal();
  refresh();
}

/* ====== Random ====== */
function pickRandom(){
  if(!ITEMS.length) return null;
  return ITEMS[Math.floor(Math.random() * ITEMS.length)];
}
function showRandom(){
  const it = pickRandom();
  if(!it){
    randomBox.classList.remove("hidden");
    randomBox.innerHTML = `<div class="muted">No hay CDs cargados todavía.</div>`;
    return;
  }

  const yt = it.youtube || ytFallback(it);
  const img = it.image ? `<img src="${esc(it.image)}" style="width:120px;height:120px;object-fit:cover;">` : `<div style="font-size:44px;opacity:.85">💿</div>`;
  const date = it.date || "—";

  const html = `
    <div class="detail">
      <div class="cover" style="border-radius:18px;overflow:hidden;">${img}</div>
      <div>
        <div class="h1">${esc(it.album || "—")}</div>
        <div class="muted">${esc(it.artist || "—")}</div>
        <div class="chips" style="margin-top:10px;">
          <span class="chip">🗓️ ${esc(date)}</span>
          <span class="chip">${it.state === "Nuevo" ? "🆕" : "♻️"} ${esc(it.state||"—")}</span>
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

  document.getElementById("btnAnother").addEventListener("click", showRandom);
  document.getElementById("btnFicha").addEventListener("click", () => openDetail(it.id));

  // modal lindo también
  openModal("🎲 Random CD", html);
}

/* ====== Import/Export ====== */
function exportJSON(){
  const blob = new Blob([JSON.stringify(ITEMS, null, 2)], {type:"application/json"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "cd-collection-backup.json";
  a.click();
  URL.revokeObjectURL(url);
}

function importJSON(file){
  const reader = new FileReader();
  reader.onload = () => {
    try{
      const data = JSON.parse(reader.result);
      if(!Array.isArray(data)) throw new Error("Formato inválido");
      // normalizar ids
      const fixed = data.map(x => ({
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
      }));
      ITEMS = fixed;
      refresh();
      alert("Importado OK ✅");
    }catch(e){
      alert("No pude importar ese JSON.");
    }
  };
  reader.readAsText(file);
}
function toCSVValue(v){
  const s = String(v ?? "");
  // escapar comillas dobles
  const escaped = s.replaceAll('"', '""');
  // si tiene coma, salto o comillas, envolver con "
  return /[",\n\r]/.test(escaped) ? `"${escaped}"` : escaped;
}

function exportCSV(){
  const headers = [
    "artist","album","city","store","price","date","state","discogs","notes","youtube","image"
  ];

  const lines = [];
  lines.push(headers.join(",")); // header

  for(const it of ITEMS){
    const row = [
      it.artist,
      it.album,
      it.city,
      it.store,
      it.price,
      it.date,
      it.state,
      it.discogs ? "1" : "0",
      it.notes,
      it.youtube,
      it.image
    ].map(toCSVValue).join(",");
    lines.push(row);
  }

  const blob = new Blob([lines.join("\n")], {type:"text/csv;charset=utf-8"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "cd-collection.csv";
  a.click();
  URL.revokeObjectURL(url);
}
function parseCSV(text){
  // parser simple que soporta comillas
  const rows = [];
  let row = [];
  let cur = "";
  let inQuotes = false;

  for(let i=0;i<text.length;i++){
    const ch = text[i];
    const next = text[i+1];

    if(inQuotes){
      if(ch === '"' && next === '"'){ cur += '"'; i++; continue; }
      if(ch === '"'){ inQuotes = false; continue; }
      cur += ch;
      continue;
    }

    if(ch === '"'){ inQuotes = true; continue; }
    if(ch === ","){ row.push(cur); cur=""; continue; }
    if(ch === "\n"){
      row.push(cur); cur="";
      // evitar filas vacías al final
      if(row.some(x => String(x).trim() !== "")) rows.push(row);
      row = [];
      continue;
    }
    if(ch === "\r"){ continue; }

    cur += ch;
  }
  // last cell
  row.push(cur);
  if(row.some(x => String(x).trim() !== "")) rows.push(row);

  return rows;
}

function importCSV(file){
  const reader = new FileReader();
  reader.onload = () => {
    try{
      const text = String(reader.result || "");
      const rows = parseCSV(text);
      if(rows.length < 2) throw new Error("CSV vacío");

      const headers = rows[0].map(h => String(h||"").trim().toLowerCase());
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

      // soportar headers en español si tu CSV viene de tu sheet
      const alt = (a,b) => map[a] !== -1 ? map[a] : idx(b);
      map.artist = alt("artist","interprete");
      map.city   = alt("city","ciudad de compra");
      map.store  = alt("store","tienda");
      map.price  = alt("price","precio");
      map.date   = alt("date","fecha de compra");
      map.state  = alt("state","estado");
      map.notes  = alt("notes","observacion");
      map.youtube= alt("youtube","youtube music link");
      map.image  = alt("image","imagen_url");

      const now = Date.now();
      const imported = [];

      for(let r=1;r<rows.length;r++){
        const line = rows[r];
        const get = (k) => {
          const i = map[k];
          return i >= 0 ? String(line[i] ?? "").trim() : "";
        };

        const discogsRaw = get("discogs").toLowerCase();
        const discogs = discogsRaw === "1" || discogsRaw === "true" || discogsRaw === "si" || discogsRaw === "sí" || discogsRaw === "x";

        const item = {
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
        };

        if(!item.artist && !item.album) continue;
        imported.push(item);
      }

      // Elegí: reemplazar todo o sumar
      const replace = confirm("¿Querés REEMPLAZAR tu colección con lo importado?\nOK = Reemplazar\nCancelar = Sumar");
      ITEMS = replace ? imported : imported.concat(ITEMS);

      refresh();
      alert(`Importado OK ✅ (${imported.length} CDs)`);
    }catch(e){
      alert("No pude importar ese CSV. Revisá que tenga encabezados (artist, album, etc).");
    }
  };
  reader.readAsText(file);
}
function seedExample(){
  if(ITEMS.length && !confirm("Esto va a agregar ejemplos. ¿Seguimos?")) return;
  const now = Date.now();
  ITEMS = [
    {id:uid(), artist:"BRUNO MARS", album:"24K MAGIC", state:"Usado", discogs:true, date:"2026-02-28", city:"BUENOS AIRES", store:"PARQUE RIVADAVIA", price:"10.03", notes:"Segundo disco del artista", youtube:"", image:"", createdAt:now, updatedAt:now},
    {id:uid(), artist:"MICHAEL JACKSON", album:"THRILLER (40 AÑOS)", state:"Nuevo", discogs:true, date:"2026-02-16", city:"MADRID", store:"CORTE INGLÉS", price:"20.15", notes:"Primer CD de todos", youtube:"", image:"", createdAt:now, updatedAt:now},
    {id:uid(), artist:"CHARLY GARCIA", album:"CLICS MODERNOS", state:"Nuevo", discogs:false, date:"2026-02-24", city:"BUENOS AIRES", store:"LEF", price:"7.56", notes:"", youtube:"", image:"", createdAt:now, updatedAt:now},
  ].concat(ITEMS);
  refresh();
}

/* ====== Events ====== */
document.getElementById("btnAdd").addEventListener("click", () => openEdit(null));
document.getElementById("btnRandom").addEventListener("click", () => { showPage("random"); showRandom(); });
document.getElementById("btnRandomHome").addEventListener("click", () => { showPage("random"); showRandom(); });

qEl.addEventListener("input", renderLib);
fEstadoEl.addEventListener("change", renderLib);
fDiscogsEl.addEventListener("change", renderLib);

document.getElementById("btnExport").addEventListener("click", exportJSON);
document.getElementById("fileImport").addEventListener("change", (e) => {
  const f = e.target.files?.[0];
  if(f) importJSON(f);
  e.target.value = "";
});
document.getElementById("btnSeed").addEventListener("click", seedExample);
document.getElementById("btnExportCSV").addEventListener("click", exportCSV);

document.getElementById("fileImportCSV").addEventListener("change", (e) => {
  const f = e.target.files?.[0];
  if(f) importCSV(f);
  e.target.value = "";
});
/* ====== PWA ====== */
if("serviceWorker" in navigator){
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(()=>{}));
}

/* ====== Boot ====== */
refresh();
showPage("home");
