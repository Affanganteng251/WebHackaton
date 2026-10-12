const $ = (s) => document.querySelector(s);
const fmt = (n) => n.toLocaleString("id-ID");
const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );

// Skala AQI⁺ US
const LEVELS = [
  {
    max: 50,
    c: "#2e9e5b",
    l: "Baik",
    t: "Udara aman untuk aktivitas di luar ruangan.",
  },
  {
    max: 100,
    c: "#e0b100",
    fg: "#1b1b1b",
    l: "Sedang",
    t: "Orang yang sangat sensitif sebaiknya mengurangi aktivitas berat di luar.",
  },
  {
    max: 150,
    c: "#f07c00",
    l: "Tidak sehat bagi kelompok sensitif",
    t: "Anak, lansia, dan penderita asma atau penyakit jantung sebaiknya tinggal di dalam ruangan.",
  },
  {
    max: 200,
    c: "#d62828",
    l: "Tidak sehat",
    t: "Kurangi aktivitas di luar, tutup jendela, dan pakai masker N95 bila harus keluar.",
  },
  {
    max: 300,
    c: "#8f3f97",
    l: "Sangat tidak sehat",
    t: "Tetap di dalam ruangan dengan jendela tertutup dan nyalakan pembersih udara bila ada.",
  },
  {
    max: Infinity,
    c: "#7e0023",
    l: "Berbahaya",
    t: "Hindari keluar rumah. Ikuti arahan BPBD setempat dan siapkan rencana evakuasi.",
  },
];
const lv = (v) => LEVELS.find((x) => v <= x.max);
const chip = (v) =>
  `<span class="aqi" style="--c:${lv(v).c};--fg:${lv(v).fg || "#fff"}">${v}</span>`;
const worst = (f) => Math.max(...f.cities.map((c) => c.aqi));

let fires = [],
  query = "",
  markers = {};
const map = L.map("map").setView([-2.2, 117.2], 5);
L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
  attribution: "&copy; OpenStreetMap &copy; CARTO",
  maxZoom: 18,
}).addTo(map);
const fireLayer = L.layerGroup().addTo(map);
const cityLayer = L.layerGroup().addTo(map);

const visible = () =>
  fires.filter((f) =>
    (f.name + f.province + f.cities.map((c) => c.name).join(" "))
      .toLowerCase()
      .includes(query),
  );

async function load() {
  $("#state").textContent = "Memuat data kebakaran…";
  try {
    const data = await fetchFireData();
    fires = data.fires.slice().sort((a, b) => worst(b) - worst(a));
    $("#state").textContent = "";
    $("#fire-count").textContent = fmt(fires.length);
    $("#ha-count").textContent = fmt(data.burnedHectares);
    $("#updated").textContent =
      new Date(data.updatedAt)
        .toLocaleString("id-ID", {
          timeZone: "Asia/Jakarta",
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        })
        .replace(".", ":") + " WIB";
    $("#sample-note").textContent = CONFIG.USE_SAMPLE ? "(data contoh)" : "";
    drawMap();
    drawList();
    drawAlerts();
    drawNews(data.news || []);
    drawProvinces();
  } catch (e) {
    $("#state").innerHTML =
      'Data tidak bisa dimuat. Periksa koneksi, lalu <button class="link" id="retry">muat ulang</button>.';
    $("#retry").onclick = load;
  }
}

function drawMap() {
  fireLayer.clearLayers();
  cityLayer.clearLayers();
  markers = {};
  visible().forEach((f) => {
    const icon = L.divIcon({
      className: "fire-pin",
      html: "<i></i>",
      iconSize: [22, 22],
    });
    markers[f.id] = L.marker([f.lat, f.lng], { icon, title: f.name })
      .addTo(fireLayer)
      .bindPopup(
        `<strong>${esc(f.name)}</strong><br>${esc(f.province)}<br><button class="link" onclick="openDetailModal('${f.id}')">Lihat detail</button>`,
      )
      .on("click", () => mark(f.id));
    f.cities.forEach((c) =>
      L.circleMarker([c.lat, c.lng], {
        radius: 7,
        color: "#fff",
        weight: 1.5,
        fillColor: lv(c.aqi).c,
        fillOpacity: 0.95,
      })
        .bindTooltip(`${c.name}: AQI ${c.aqi}`)
        .addTo(cityLayer),
    );
  });
}

function drawList() {
  const list = visible();
  $("#fire-list").innerHTML = list.length
    ? list
        .map(
          (f) =>
            `<li><button type="button" data-id="${f.id}"><span><strong>${esc(f.name)}</strong><small>${esc(f.province)}</small></span>${chip(worst(f))}</button></li>`,
        )
        .join("")
    : `<li class="empty">Tidak ada kebakaran yang cocok dengan “${esc(query)}”. Hapus kata kunci untuk melihat semua.</li>`;
}

function drawAlerts() {
  $("#alerts").innerHTML = fires
    .map(
      (f) =>
        `<li><div><h3>${esc(f.name)}</h3><p>${esc(f.province)}. Udara ${lv(worst(f)).l.toLowerCase()}.</p></div><div class="cities">${f.cities.map((c) => `<span>${esc(c.name)}${chip(c.aqi)}</span>`).join("")}</div></li>`,
    )
    .join("");
}

function drawNews(items) {
  $("#news").innerHTML = items.length
    ? items
        .map(
          (n) =>
            `<li><a href="${esc(n.url)}" target="_blank" rel="noopener"><strong>${esc(n.title)}</strong></a><small>${esc(n.source)}, ${new Date(n.date).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</small></li>`,
        )
        .join("")
    : '<li class="empty">Belum ada berita. Berita akan tampil di sini setelah sumber berita tersambung ke API.</li>';
}

function drawProvinces() {
  const count = (p) => fires.filter((f) => f.affected.includes(p)).length;
  $("#province-grid").innerHTML = PROVINCES.map((p) => {
    const n = count(p);
    return `<button type="button" class="${n ? "has" : ""}" data-p="${esc(p)}" ${n ? "" : "disabled"}>${esc(p)}<b>${n || "–"}</b></button>`;
  }).join("");
  $("#province-tables").innerHTML = PROVINCES.filter(count)
    .map(
      (p) =>
        `<h3>Kebakaran aktif di ${esc(p)}</h3><table><thead><tr><th>Kebakaran</th><th>Kota terdampak (AQI⁺ US)</th></tr></thead><tbody>` +
        fires
          .filter((f) => f.affected.includes(p))
          .map(
            (f) =>
              `<tr><td>${esc(f.name)}</td><td>${f.cities.map((c) => `${esc(c.name)}${chip(c.aqi)}`).join("")}</td></tr>`,
          )
          .join("") +
        "</tbody></table>",
    )
    .join("");
}

$("#legend").innerHTML = LEVELS.map(
  (x) =>
    `<div style="--c:${x.c};--fg:${x.fg || "#fff"}"><b>${x.max === Infinity ? "301+" : "≤ " + x.max}</b>${x.l}</div>`,
).join("");

function mark(id) {
  document
    .querySelectorAll(".fire-list button")
    .forEach((b) => b.setAttribute("aria-current", b.dataset.id === id));
}
function focusFire(id) {
  const f = fires.find((x) => x.id === id);
  if (!f) return;
  mark(id);
  map.flyTo([f.lat, f.lng], 7, { duration: 1 });
  if (markers[id]) markers[id].openPopup();
  if (window.innerWidth <= 900)
    $("#map").scrollIntoView({ behavior: "smooth" });
}

// ==========================================
// Modal Detail Peta (Lama)
// ==========================================
const detailModal = $("#detail-modal");
function openDetailModal(id) {
  const f = fires.find((x) => x.id === id),
    top = lv(worst(f));
  $("#modal-body").innerHTML =
    `<h3 id="modal-title">${esc(f.name)}</h3><p class="sub">${esc(f.province)} · ${f.lat.toFixed(2)}, ${f.lng.toFixed(2)}</p>
    <table><thead><tr><th>Kota terdampak</th><th>AQI⁺ US</th></tr></thead><tbody>${f.cities
      .map(
        (c) =>
          `<tr><td>${esc(c.name)}</td><td>${chip(c.aqi)}${lv(c.aqi).l}</td></tr>`,
      )
      .join("")}</tbody></table>
    <p class="advice" style="--c:${top.c}">${top.t}</p>`;
  detailModal.classList.add("open");
  $("#modal-close").focus();
}
const closeDetailModal = () => detailModal.classList.remove("open");
$("#modal-close").onclick = closeDetailModal;
detailModal.onclick = (e) => {
  if (e.target === detailModal) closeDetailModal();
};

// ==========================================
// Modal Edukasi (Baru: PM2.5, PM10, Ozon)
// ==========================================
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add("active");
    document.body.style.overflow = "hidden";
    if (typeof feather !== "undefined") {
      feather.replace();
    }
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove("active");
    document.body.style.overflow = "auto";
  }
}

// Menutup modal edukasi jika klik area background
window.addEventListener("click", function (event) {
  if (event.target.classList.contains("edu-modal-overlay")) {
    event.target.classList.remove("active");
    document.body.style.overflow = "auto";
  }
});

// Menutup semua jenis modal dengan tombol Escape
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeDetailModal(); // Tutup modal peta (lama)

    // Tutup modal edukasi (baru)
    const activeEduModals = document.querySelectorAll(
      ".edu-modal-overlay.active",
    );
    activeEduModals.forEach((modal) => {
      modal.classList.remove("active");
      document.body.style.overflow = "auto";
    });
  }
});

// Klik daftar & provinsi
$("#fire-list").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (b) focusFire(b.dataset.id);
});
$("#province-grid").addEventListener("click", (e) => {
  const b = e.target.closest("button.has");
  if (!b) return;
  const f = fires.find((x) => x.affected.includes(b.dataset.p));
  $("#peta").scrollIntoView();
  focusFire(f.id);
});

// Lapisan AQI, muat ulang, pencarian
$("#toggle-aqi").onchange = (e) =>
  e.target.checked ? cityLayer.addTo(map) : map.removeLayer(cityLayer);
$("#refresh").onclick = load;
$("#search-box").addEventListener("input", (e) => {
  query = e.target.value.trim().toLowerCase();
  drawMap();
  drawList();
});

// Navbar (dari project lama)
const nav = $("#navbar-nav"),
  searchForm = $("#search-form");
$("#hamburger-menu").onclick = () => nav.classList.toggle("active");
$("#search-button").onclick = () => {
  searchForm.classList.toggle("active");
  $("#search-box").focus();
};
document.addEventListener("click", (e) => {
  if (!e.target.closest("#hamburger-menu, #navbar-nav"))
    nav.classList.remove("active");
  if (!e.target.closest("#search-button, #search-form"))
    searchForm.classList.remove("active");
});

// Form laporan. TODO backend: kirim FormData ke API (fetch POST) sebelum menampilkan status.
$("#report-form").addEventListener("submit", (e) => {
  e.preventDefault();
  $("#report-status").textContent = "Laporan terkirim. Terima kasih.";
  e.target.reset();
});

load();
