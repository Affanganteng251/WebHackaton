
const $ = (s) => document.querySelector(s);

const fmt = (n) => n.toLocaleString("id-ID");

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) =>
    ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[c]
  );

// Skala AQI US
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
    t: "Kurangi aktivitas di luar.",
  },
  {
    max: 300,
    c: "#8f3f97",
    l: "Sangat tidak sehat",
    t: "Tetap di dalam ruangan dengan jendela tertutup.",
  },
  {
    max: Infinity,
    c: "#7e0023",
    l: "Berbahaya",
    t: "Hindari keluar rumah dan ikuti arahan BPBD setempat.",
  },
];

const lv = (v) => LEVELS.find((x) => v <= x.max);

const chip = (v) =>
  `<span class="aqi" style="--c:${lv(v).c};--fg:${lv(v).fg || "#fff"}">${v}</span>`;

const worst = (f) => Math.max(...f.cities.map((c) => c.aqi));

let fires = [];
let query = "";
let markers = {};

// Mode Data Operasional (database default vs simulation)
let currentDataMode = CONFIG.DATA_MODE || "database";
let currentHorizon = 7;
let simulationRiskByGid = {};

// Cek parameter URL untuk aktivasi langsung mode simulasi (?mode=simulasi atau ?simulation=true)
try {
  const urlParams = new URLSearchParams(window.location.search);
  const qMode = urlParams.get("mode");
  const qSim = urlParams.get("simulation");
  if (qMode === "simulasi" || qMode === "simulation" || qSim === "true") {
    CONFIG.DATA_MODE = "simulation";
    currentDataMode = "simulation";
  }
} catch (e) {
  // Abaikan jika window.location tidak tersedia
}

// Skema Pewarnaan Poligon Kecamatan Berdasarkan Kategori Risiko Simulasi
function getDistrictStyle(feature) {
  if (CONFIG.DATA_MODE === "simulation") {
    const gid_3 = feature?.properties?.gid_3;
    const simRisk = simulationRiskByGid[gid_3];
    const cat = simRisk?.category || "unknown";

    if (cat === "extreme") {
      return {
        color: "#991b1b",
        weight: 1.8,
        opacity: 0.9,
        fillColor: "#dc2626",
        fillOpacity: 0.38,
      };
    } else if (cat === "high") {
      return {
        color: "#c2410c",
        weight: 1.6,
        opacity: 0.85,
        fillColor: "#ea580c",
        fillOpacity: 0.30,
      };
    } else if (cat === "medium") {
      return {
        color: "#b45309",
        weight: 1.4,
        opacity: 0.8,
        fillColor: "#eab308",
        fillOpacity: 0.22,
      };
    } else if (cat === "low") {
      return {
        color: "#15803d",
        weight: 1.2,
        opacity: 0.75,
        fillColor: "#16a34a",
        fillOpacity: 0.15,
      };
    }
  }

  // Gaya default: Mode Database (Biru netral PostGIS)
  return {
    color: "#1e5b8a",
    weight: 1.2,
    opacity: 0.75,
    fillColor: "#3182ce",
    fillOpacity: 0.05,
  };
}

// Wilayah peta Kalimantan
const KALIMANTAN_BOUNDS = [
  [-4.8, 108.5],
  [4.6, 119.5],
];

const map = L.map("map", {
  minZoom: 5,
  maxBounds: [
    [-9, 104],
    [9, 124],
  ],
}).fitBounds(KALIMANTAN_BOUNDS);

// Peta dasar OpenStreetMap
L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
  maxZoom: 19,
}).addTo(map);

L.control.scale({
  metric: true,
  imperial: false,
}).addTo(map);

if (!map.getPane("districts")) {
  map.createPane("districts");
  map.getPane("districts").style.zIndex = 390;
}
if (!map.getPane("hotspots")) {
  map.createPane("hotspots");
  map.getPane("hotspots").style.zIndex = 450;
}

const fireLayer = L.layerGroup().addTo(map);
const cityLayer = L.layerGroup().addTo(map);
const hotspotLayer = L.layerGroup().addTo(map);
const districtLabelLayer = L.layerGroup().addTo(map);
let districtIndex = [];

const districtLayer = L.geoJSON(null, {
  pane: "districts",
  style: (feature) => getDistrictStyle(feature),
  onEachFeature: function (feature, layer) {
    const props = feature.properties || {};
    const name = props.name || "Kecamatan";
    const regency = props.regency || "";
    const province = props.province || "";

    const bounds = layer.getBounds ? layer.getBounds() : null;
    const center = bounds ? bounds.getCenter() : null;

    districtIndex.push({
      gid_3: props.gid_3,
      name: name,
      regency: regency,
      province: province,
      properties: props,
      layer: layer,
      bounds: bounds,
      center: center,
    });

    layer.bindTooltip(
      `<strong>${esc(name)}</strong><br><small>${esc(regency)}, ${esc(province)}</small>`,
      { sticky: true, className: "district-tooltip" }
    );

    layer.on({
      mouseover: function (e) {
        const l = e.target;
        const base = getDistrictStyle(feature);
        l.setStyle({
          weight: base.weight + 1.2,
          color: base.color,
          fillOpacity: Math.min(base.fillOpacity + 0.18, 0.7),
        });
      },
      mouseout: function (e) {
        districtLayer.resetStyle(e.target);
      },
      click: function (e) {
        openDistrictSummary(props, e.latlng);
      },
    });
  },
}).addTo(map);

// Filter pencarian untuk daftar kebakaran
const visible = () =>
  fires.filter((f) =>
    (
      f.name +
      f.province +
      f.cities.map((c) => c.name).join(" ")
    )
      .toLowerCase()
      .includes(query)
  );

// ==========================================
// KONTROL MODE SIMULASI & HORIZON
// ==========================================

async function loadSimulationRisk(horizon = currentHorizon) {
  try {
    const url = `${CONFIG.SIMULATION_RISK_URL || "http://127.0.0.1:8000/v1/simulation/risk"}?horizon=${horizon}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    simulationRiskByGid = {};
    (data.items || []).forEach((item) => {
      if (item.gid_3) {
        simulationRiskByGid[item.gid_3] = item;
      }
    });
    // Perbarui gaya poligon kecamatan
    districtLayer.setStyle((feature) => getDistrictStyle(feature));
  } catch (err) {
    console.error("Gagal memuat risiko simulasi:", err);
  }
}

async function switchDataMode(mode) {
  CONFIG.DATA_MODE = mode;
  currentDataMode = mode;

  const btnDb = $("#btn-mode-db");
  const btnSim = $("#btn-mode-sim");
  const banner = $("#simulation-banner");
  const horizonControl = $("#horizon-control");
  const chipSim = $("#chip-simulation");
  const chipPending = $("#chip-pending");
  const legendSimHotspot = $("#legend-sim-hotspot");

  if (mode === "simulation") {
    if (btnDb) btnDb.classList.remove("active");
    if (btnSim) btnSim.classList.add("active");
    if (banner) banner.style.display = "flex";
    if (horizonControl) horizonControl.style.display = "flex";
    if (chipSim) chipSim.style.display = "inline-flex";
    if (chipPending) chipPending.style.display = "none";
    if (legendSimHotspot) legendSimHotspot.style.display = "inline-flex";

    await loadSimulationRisk(currentHorizon);
  } else {
    if (btnSim) btnSim.classList.remove("active");
    if (btnDb) btnDb.classList.add("active");
    if (banner) banner.style.display = "none";
    if (horizonControl) horizonControl.style.display = "none";
    if (chipSim) chipSim.style.display = "none";
    if (chipPending) chipPending.style.display = "inline-flex";
    if (legendSimHotspot) legendSimHotspot.style.display = "none";

    simulationRiskByGid = {};
    districtLayer.setStyle((feature) => getDistrictStyle(feature));
  }

  await load();
}

async function setSimulationHorizon(horizon) {
  currentHorizon = horizon;
  document.querySelectorAll(".horizon-btn").forEach((btn) => {
    if (parseInt(btn.dataset.horizon, 10) === horizon) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });

  if (CONFIG.DATA_MODE === "simulation") {
    await loadSimulationRisk(currentHorizon);
    const count = hotspotLayer.getLayers().length;
    $("#state").textContent = `🧪 Mode Simulasi Aktif: ${count} titik api simulasi sintetis pada horizon ${currentHorizon} hari (bukan kebakaran aktual).`;
  }
}

// ==========================================
// MEMUAT DATA
// ==========================================

async function load() {
  $("#state").textContent = "Memuat data kebakaran…";

  try {
    const data = await fetchFireData();
    const isSim = CONFIG.DATA_MODE === "simulation";

    // Mode sample: tampilkan data ilustrasi.
    // Mode API: jangan gunakan data fires contoh sebagai data aktual.
    fires = CONFIG.USE_SAMPLE
      ? data.fires.slice().sort((a, b) => worst(b) - worst(a))
      : [];

    if (isSim) {
      $("#state").textContent = `🧪 Mode Simulasi Aktif: ${(data.hotspots || []).length} titik api simulasi sintetis pada horizon ${currentHorizon} hari (bukan kebakaran aktual).`;
      $("#fire-count").textContent = "0"; // Data simulasi TIDAK dihitung dalam kebakaran aktual
      $("#ha-count").textContent = "–";  // Data simulasi TIDAK ikut dihitung dalam luas terbakar aktual
      $("#sample-note").innerHTML = '<span class="status-pill sim">(mode simulasi)</span>';
    } else {
      const testHotspots = (data.hotspots || []).filter(
        (h) =>
          String(h.id || "").toUpperCase().includes("TEST") ||
          String(h.dataSource || "").toLowerCase().includes("test")
      );
      const isOnlyTest =
        testHotspots.length > 0 &&
        testHotspots.length === (data.hotspots || []).length;

      $("#state").textContent = CONFIG.USE_SAMPLE
        ? ""
        : isOnlyTest
          ? `🟢 Mode Realtime: ${testHotspots.length} titik api uji (${testHotspots.map((h) => h.id).join(", ")}) terdeteksi dari database (bukan kebakaran aktual). Feed satelit belum terhubung.`
          : data.hotspots && data.hotspots.length
            ? `🟢 Mode Realtime: ${data.hotspots.length} titik api terdeteksi dari database. Feed satelit belum terhubung.`
            : "🟢 Mode Realtime: Tidak ada titik api terdeteksi di database. Feed satelit belum terhubung.";

      $("#fire-count").textContent = fmt(fires.length);
      $("#ha-count").textContent = CONFIG.USE_SAMPLE
        ? fmt(data.burnedHectares || 0)
        : "–";

      $("#sample-note").innerHTML = CONFIG.USE_SAMPLE
        ? '<span class="status-pill mock">(data contoh)</span>'
        : '<span class="status-pill db">(mode realtime)</span>';
    }

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

    // Tampilkan hanya data hotspot dan batas wilayah yang dikembalikan API.
    drawMap();
    drawHotspots(data.hotspots || []);
    loadDistricts();
    drawList();
    drawAlerts();

    // Berita contoh tidak ditampilkan dalam mode API.
    drawNews(CONFIG.USE_SAMPLE ? data.news || [] : []);

    drawProvinces();
  } catch (error) {
    console.error("Gagal memuat data:", error);

    $("#state").innerHTML =
      'Data tidak bisa dimuat. Periksa koneksi, lalu <button class="link" id="retry">muat ulang</button>.';

    $("#retry").onclick = load;
  }
}

// ==========================================
// MARKER KEBAKARAN DAN KUALITAS UDARA
// ==========================================

function drawMap() {
  fireLayer.clearLayers();
  cityLayer.clearLayers();
  markers = {};

  // Dalam mode API, fires kosong sampai endpoint fires tersedia.
  visible().forEach((f) => {
    const icon = L.divIcon({
      className: "fire-pin",
      html: "<i></i>",
      iconSize: [22, 22],
    });

    markers[f.id] = L.marker([f.lat, f.lng], {
      icon,
      title: f.name,
    })
      .addTo(fireLayer)
      .bindPopup(
        `<strong>${esc(f.name)}</strong><br>${esc(f.province)}<br><button class="link" onclick="openDetailModal('${f.id}')">Lihat detail</button>`
      )
      .on("click", () => mark(f.id));

    f.cities.forEach((c) => {
      L.circleMarker([c.lat, c.lng], {
        radius: 7,
        color: "#fff",
        weight: 1.5,
        fillColor: lv(c.aqi).c,
        fillOpacity: 0.95,
      })
        .bindTooltip(`${c.name}: AQI ${c.aqi}`)
        .addTo(cityLayer);
    });
  });
}

// ==========================================
// HOTSPOT DARI FASTAPI
// ==========================================

function drawHotspots(list) {
  hotspotLayer.clearLayers();

  const canvas = L.canvas({ padding: 0.5, pane: "hotspots" });

  list.forEach((h) => {
    const lat = Number(h.lat);
    const lng = Number(h.lng);

    // Abaikan koordinat tidak valid.
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return;
    }

    const isSim = Boolean(
      h.isSimulation ||
      String(h.dataSource || "").toLowerCase() === "simulation" ||
      String(h.id || "").toUpperCase().startsWith("HS-SIM")
    );

    const isTest = !isSim && (
      String(h.id || "").toUpperCase().includes("TEST") ||
      String(h.dataSource || "").toLowerCase().includes("test")
    );

    const confVal =
      h.confidence !== undefined && h.confidence !== null
        ? typeof h.confidence === "number" && h.confidence <= 1
          ? Math.round(h.confidence * 100) + "%"
          : esc(h.confidence)
        : "Tidak tersedia";

    const timeVal = h.detectedAt
      ? new Date(h.detectedAt)
          .toLocaleString("id-ID", {
            timeZone: "Asia/Jakarta",
            day: "numeric",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })
          .replace(".", ":") + " WIB"
      : "Tidak tersedia";

    const idLabel = esc(h.id || "Titik Panas");
    const sourceLabel = esc(h.dataSource || (isSim ? "simulation" : "postgresql"));

    const markerColor = isSim ? "#7c3aed" : isTest ? "#d97706" : "#e11d1d";
    const badgeHtml = isSim
      ? `<div style="background: #ede9fe; border: 1px solid #c4b5fd; color: #5b21b6; padding: 3px 8px; border-radius: 4px; margin-bottom: 6px; font-weight: 700; font-size: 0.74rem;">🧪 SIMULASI — BUKAN DATA AKTUAL</div>`
      : isTest
        ? `<div style="background: #fef3c7; border: 1px solid #f59e0b; color: #92400e; padding: 3px 8px; border-radius: 4px; margin-bottom: 6px; font-weight: 600; font-size: 0.75rem;">🧪 Data Uji: Bukan kebakaran aktual</div>`
        : "";

    const titlePrefix = isSim ? "🧪 [SIMULASI] " : isTest ? "🧪 " : "🔥 ";
    const titleColor = isSim ? "#6d28d9" : isTest ? "#b45309" : "#b00020";
    const sourceSuffix = isSim ? " (sintetis/pengujian UI)" : isTest ? " (benchmark/uji)" : "";

    L.circleMarker([lat, lng], {
      pane: "hotspots",
      renderer: canvas,
      radius: isSim ? 7 : isTest ? 7 : 6,
      color: "#fff",
      weight: 1.5,
      fillColor: markerColor,
      fillOpacity: 0.95,
      interactive: true,
    })
      .bindPopup(
        `<div style="font-family: inherit; font-size: 0.85rem; line-height: 1.4;">` +
          badgeHtml +
          `<strong style="color: ${titleColor}; font-size: 0.95rem;">${titlePrefix}${idLabel}</strong><br>` +
          `<b>Koordinat:</b> ${lat.toFixed(4)}, ${lng.toFixed(4)}<br>` +
          `<b>Kepercayaan:</b> ${confVal}<br>` +
          (h.frp ? `<b>FRP:</b> ${h.frp} MW<br>` : "") +
          `<b>Terdeteksi:</b> ${timeVal}<br>` +
          `<small style="color: #666;">Sumber: ${sourceLabel}${sourceSuffix}</small>` +
          `</div>`
      )
      .addTo(hotspotLayer);
  });
}

// ==========================================
// BATAS WILAYAH KECAMATAN (POSTGIS)
// ==========================================

async function loadDistricts() {
  if (districtLayer.getLayers().length > 0) return;
  try {
    const url =
      CONFIG.DISTRICTS_GEOJSON_URL ||
      "http://127.0.0.1:8000/v1/districts/geojson";
    const res = await fetch(url);
    if (!res.ok) throw new Error("HTTP " + res.status);
    const geojson = await res.json();
    districtLayer.addData(geojson);
    districtIndex.sort((a, b) => a.name.localeCompare(b.name, "id"));
    updateDistrictLabels();
  } catch (err) {
    console.error("Gagal memuat batas kecamatan:", err);
  }
}

// ==========================================
// LABEL NAMA KECAMATAN PADA ZOOM TERTENTU
// ==========================================

function updateDistrictLabels() {
  districtLabelLayer.clearLayers();

  const toggleDistrict = $("#toggle-district");
  if (toggleDistrict && !toggleDistrict.checked) return;
  if (!map.hasLayer(districtLayer)) return;

  const currentZoom = map.getZoom();
  // Label nama kecamatan muncul pada zoom >= 9 agar tidak saling bertumpukan di tampilan pulau
  if (currentZoom < 9) return;

  const mapBounds = map.getBounds();

  districtIndex.forEach((d) => {
    if (!d.center) return;
    if (mapBounds.contains(d.center) || (d.bounds && mapBounds.intersects(d.bounds))) {
      const icon = L.divIcon({
        className: "district-map-label-wrapper",
        html: `<span class="district-map-label">${esc(d.name)}</span>`,
        iconSize: [120, 24],
        iconAnchor: [60, 12],
      });
      L.marker(d.center, { icon, interactive: false }).addTo(districtLabelLayer);
    }
  });
}

map.on("zoomend moveend", updateDistrictLabels);

async function openDistrictSummary(props, latlng) {
  const gid_3 = props.gid_3;
  const name = props.name || "Kecamatan";
  const regency = props.regency || "";
  const province = props.province || "";
  const safeId = String(gid_3 || "kec").replace(/[^a-zA-Z0-9]/g, "_");
  const isSimulation = CONFIG.DATA_MODE === "simulation";

  const initialContent = `
    <div style="font-family: inherit; min-width: 260px; font-size: 0.86rem; line-height: 1.45;">
      <div style="border-bottom: 1px solid #c4d8ca; padding-bottom: 6px; margin-bottom: 8px;">
        <span style="font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.05em; color: ${isSimulation ? '#7c3aed' : '#1e8449'}; font-weight: 700;">
          ${isSimulation ? '🧪 Batas Kecamatan (Mode Simulasi)' : 'Batas Kecamatan (Mode Realtime)'}
        </span>
        <h3 style="margin: 2px 0 0; font-size: 1.15rem; color: #0e2b1c;">${esc(name)}</h3>
        <p style="margin: 0; color: #4a6455; font-size: 0.82rem;">${esc(regency)}, ${esc(province)}</p>
        <small style="color: #64748b; font-size: 0.72rem;">GID: ${esc(gid_3)}</small>
      </div>
      <div id="summary-content-${safeId}">
        <p style="color: #4a6455; font-size: 0.82rem; margin: 4px 0;">⏳ Mengambil ringkasan dari server…</p>
      </div>
    </div>
  `;

  L.popup({ maxWidth: isSimulation ? 380 : 320, minWidth: 260 })
    .setLatLng(latlng)
    .setContent(initialContent)
    .openOn(map);

  try {
    const summaryUrl =
      (CONFIG.KECAMATAN_SUMMARY_URL ||
        "http://127.0.0.1:8000/v1/kecamatan") +
      "/" +
      encodeURIComponent(gid_3) +
      "/summary" +
      (isSimulation ? "?mode=simulation" : "");

    const res = await fetch(summaryUrl);
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    const container = document.getElementById(`summary-content-${safeId}`);
    if (!container) return;

    // JIKA DALAM MODE SIMULASI: Tampilkan Panel Komparasi Aktual vs Simulasi
    if (data.data_mode === "simulation" || data.simulation) {
      const actualHs = data.actual?.hotspots_7d ?? 0;
      const testHs = data.actual?.test_hotspots_count ?? 0;
      const simHsCount = data.simulation?.hotspots_simulated_count ?? 0;
      const weather = data.simulation?.weather;
      const soilType = data.soil_type || "Tanah Mineral";

      const riskH = data.simulation?.risk?.[`${currentHorizon}d`] || {};
      const riskCat = riskH.category || "unknown";
      const riskProb = riskH.max_probability !== null && riskH.max_probability !== undefined
        ? `${Math.round(riskH.max_probability * 100)}%`
        : "–";

      const catBadgeColor = riskCat === "extreme" ? "#991b1b" : riskCat === "high" ? "#c2410c" : riskCat === "medium" ? "#b45309" : riskCat === "low" ? "#15803d" : "#64748b";
      const catBadgeBg = riskCat === "extreme" ? "#fee2e2" : riskCat === "high" ? "#ffedd5" : riskCat === "medium" ? "#fef3c7" : riskCat === "low" ? "#dcfce7" : "#f1f5f9";

      let weatherHtml = "";
      if (weather) {
        weatherHtml = `
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; padding: 6px; margin: 6px 0; font-size: 0.76rem;">
            <div style="font-weight: 700; color: #334155; margin-bottom: 4px;">🌤️ Indikator Cuaca &amp; Kekeringan Simulasi</div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px; color: #475569;">
              <div>Suhu: <b>${weather.temperature_c}°C</b></div>
              <div>Kelembaban: <b>${weather.humidity_pct}%</b></div>
              <div>Hujan 24j: <b>${weather.rainfall_24h_mm} mm</b></div>
              <div>Hari Kering: <b>${weather.consecutive_dry_days} hari</b></div>
              <div>FWI: <b>${weather.fwi} (${esc(weather.fwi_category || "")})</b></div>
              <div>Muka Air Gambut: <b>${weather.peat_water_table_cm !== null && weather.peat_water_table_cm !== undefined ? weather.peat_water_table_cm + ' cm' : 'Mineral'}</b></div>
            </div>
          </div>
        `;
      }

      let factorsHtml = "";
      const factors = riskH.explanation_factors || [];
      if (factors.length > 0) {
        factorsHtml = `
          <div style="margin-top: 6px; font-size: 0.75rem;">
            <div style="font-weight: 700; color: #5b21b6; margin-bottom: 4px;">📊 Faktor Penjelasan Demonstrasi (${currentHorizon} Hari):</div>
            <ul style="margin: 0; padding-left: 1.1rem; color: #334155; line-height: 1.35;">
              ${factors.map(f => `<li><b>${esc(f.factor)}</b> <span style="background: #ede9fe; color: #5b21b6; font-size: 0.68rem; font-weight: 700; padding: 1px 4px; border-radius: 2px;">${esc(f.impact)}</span>: ${esc(f.description)}</li>`).join("")}
            </ul>
            <div style="margin-top: 4px; font-size: 0.69rem; color: #64748b; font-style: italic;">
              *Contoh faktor demonstrasi antarmuka — Bukan klaim output model SHAP/ML.*
            </div>
          </div>
        `;
      }

      container.innerHTML = `
        <div style="background: #ede9fe; border: 1px solid #c4b5fd; color: #5b21b6; padding: 3px 6px; border-radius: 3px; font-weight: 700; font-size: 0.72rem; margin-bottom: 6px; text-align: center;">
          🧪 SIMULASI — BUKAN DATA AKTUAL
        </div>

        <div style="font-size: 0.75rem; color: #475569; margin-bottom: 6px;">
          Tipe Lahan: <b>${esc(soilType)}</b>
        </div>

        <div style="border-left: 3px solid #1e5b8a; padding-left: 6px; margin-bottom: 6px;">
          <div style="font-size: 0.73rem; font-weight: 700; color: #1e5b8a;">1. DATA AKTUAL / REALTIME (POSTGIS)</div>
          <div style="font-size: 0.78rem; color: #334155;">Hotspot 7 Hari: <b>${actualHs}</b> titik api aktual</div>
          ${testHs > 0 ? `<div style="font-size: 0.73rem; color: #b45309; background: #fef3c7; padding: 2px 4px; border-radius: 2px; margin-top: 2px;">🧪 ${testHs} titik data uji (TEST-001) terdeteksi (bukan kebakaran aktual)</div>` : ""}
          <div style="font-size: 0.71rem; color: #64748b; font-style: italic;">Feed Satelit &amp; Model ML: Belum terhubung (Probabilitas aktual: null)</div>
        </div>

        <div style="border-left: 3px solid #7c3aed; padding-left: 6px; margin-top: 6px;">
          <div style="font-size: 0.73rem; font-weight: 700; color: #7c3aed;">2. DATA SIMULASI DEMONSTRASI</div>
          <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 3px; font-size: 0.79rem;">
            <span>Risiko (${currentHorizon} Hari):</span>
            <span style="background: ${catBadgeBg}; color: ${catBadgeColor}; font-weight: 800; font-size: 0.75rem; padding: 2px 6px; border-radius: 3px; border: 1px solid ${catBadgeColor};">
              ${riskProb} (${esc(riskCat)})
            </span>
          </div>
          <div style="font-size: 0.78rem; color: #334155; margin-top: 2px;">
            Hotspot Simulasi: <b>${simHsCount}</b> titik sintetis
          </div>
          <div style="font-size: 0.71rem; color: #64748b; margin-top: 2px;">
            Horizons: 7d: <b>${data.simulation?.risk?.["7d"]?.max_probability ? Math.round(data.simulation.risk["7d"].max_probability * 100) + '%' : '–'}</b> · 14d: <b>${data.simulation?.risk?.["14d"]?.max_probability ? Math.round(data.simulation.risk["14d"].max_probability * 100) + '%' : '–'}</b> · 30d: <b>${data.simulation?.risk?.["30d"]?.max_probability ? Math.round(data.simulation.risk["30d"].max_probability * 100) + '%' : '–'}</b>
          </div>
        </div>

        ${weatherHtml}
        ${factorsHtml}
      `;
      return;
    }

    // MODE DATABASE: Tampilkan tabel ringkasan standar database
    const hsVal =
      data.hotspots_7d !== null && data.hotspots_7d !== undefined
        ? `<b>${data.hotspots_7d}</b> titik api aktif`
        : '<span style="color: #64748b; font-style: italic;">Belum tersedia</span>';

    const testHsVal = data.test_hotspots_7d
      ? `<div style="margin-top: 4px; color: #b45309; font-size: 0.76rem; background: #fef3c7; border: 1px solid #f59e0b; padding: 2px 6px; border-radius: 3px;">🧪 ${data.test_hotspots_7d} titik data uji (TEST-001) terdeteksi (bukan kebakaran aktual)</div>`
      : "";

    const formatRisk = (r) => {
      if (
        !r ||
        r.max_probability === null ||
        r.max_probability === undefined ||
        r.category === "unknown"
      ) {
        return '<span style="color: #64748b; font-style: italic;">Belum tersedia</span>';
      }
      return `<b>${Math.round(r.max_probability * 100)}%</b> (${esc(r.category)})`;
    };

    const risk7 = formatRisk(data.risk?.["7d"]);
    const risk14 = formatRisk(data.risk?.["14d"]);
    const risk30 = formatRisk(data.risk?.["30d"]);

    let noteHtml = "";
    if (data.warning) {
      noteHtml = `<div style="margin-top: 6px; font-size: 0.72rem; color: #4a6455; background: #eef5f0; padding: 4px 6px; border-radius: 4px; line-height: 1.3;">ℹ️ ${esc(data.warning)}</div>`;
    }

    container.innerHTML = `
      <table style="width: 100%; border-collapse: collapse; font-size: 0.82rem; margin-top: 4px;">
        <tr>
          <td style="padding: 3px 0; color: #4a6455;">Hotspot (7 hari):</td>
          <td style="padding: 3px 0; text-align: right;">${hsVal}</td>
        </tr>
        <tr>
          <td style="padding: 3px 0; color: #4a6455;">Risiko 7 hari:</td>
          <td style="padding: 3px 0; text-align: right;">${risk7}</td>
        </tr>
        <tr>
          <td style="padding: 3px 0; color: #4a6455;">Risiko 14 hari:</td>
          <td style="padding: 3px 0; text-align: right;">${risk14}</td>
        </tr>
        <tr>
          <td style="padding: 3px 0; color: #4a6455;">Risiko 30 hari:</td>
          <td style="padding: 3px 0; text-align: right;">${risk30}</td>
        </tr>
      </table>
      ${testHsVal}
      ${noteHtml}
    `;
  } catch (err) {
    console.error("Gagal memuat ringkasan kecamatan:", err);
    const container = document.getElementById(`summary-content-${safeId}`);
    if (container) {
      container.innerHTML = `
        <p style="color: #b00020; font-size: 0.8rem; margin: 4px 0;">
          Gagal mengambil ringkasan kecamatan dari server.
        </p>
      `;
    }
  }
}

// ==========================================
// DAFTAR KEBAKARAN
// ==========================================

function drawList() {
  const list = visible();

  $("#fire-list").innerHTML = list.length
    ? list
        .map(
          (f) =>
            `<li><button type="button" data-id="${esc(f.id)}"><span><strong>${esc(f.name)}</strong><small>${esc(f.province)}</small></span>${chip(worst(f))}</button></li>`
        )
        .join("")
    : `<li class="empty">${
        CONFIG.USE_SAMPLE
          ? `Tidak ada kebakaran yang cocok dengan “${esc(query)}”. Hapus kata kunci untuk melihat semua.`
          : "Data kebakaran wilayah aktual belum tersedia dari database/sensor satelit."
      }</li>`;
}

// ==========================================
// PERINGATAN
// ==========================================

function drawAlerts() {
  $("#alerts").innerHTML = fires.length
    ? fires
        .map(
          (f) =>
            `<li><div><h3>${esc(f.name)}</h3><p>${esc(f.province)}. Udara ${lv(worst(f)).l.toLowerCase()}.</p></div><div class="cities">${f.cities
              .map(
                (c) =>
                  `<span>${esc(c.name)}${chip(c.aqi)}</span>`
              )
              .join("")}</div></li>`
        )
        .join("")
    : '<li class="empty">Data peringatan risiko dan kualitas udara belum tersedia dari API/model ML.</li>';
}

// ==========================================
// BERITA
// ==========================================

function drawNews(items) {
  $("#news").innerHTML = items.length
    ? items
        .map(
          (n) =>
            `<li><a href="${esc(n.url)}" target="_blank" rel="noopener"><strong>${esc(n.title)}</strong></a><small>${esc(n.source)}, ${new Date(n.date).toLocaleDateString("id-ID", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}</small></li>`
        )
        .join("")
    : '<li class="empty">Belum ada berita aktual dari feed API. Data berita akan muncul saat feed eksternal terhubung.</li>';
}

// ==========================================
// RINGKASAN PROVINSI
// ==========================================

function drawProvinces() {
  const PROVINCES = [
    "Kalimantan Barat",
    "Kalimantan Tengah",
    "Kalimantan Selatan",
    "Kalimantan Timur",
    "Kalimantan Utara",
  ];

  const count = (p) =>
    fires.filter((f) => f.affected.includes(p)).length;

  $("#province-grid").innerHTML = PROVINCES.map((p) => {
    const n = count(p);

    return `<button type="button" class="${n ? "has" : ""}" data-p="${esc(p)}" ${
      n ? "" : "disabled"
    }>${esc(p)}<b>${n || "–"}</b></button>`;
  }).join("");

  const activeProvinces = PROVINCES.filter(count);
  $("#province-tables").innerHTML = activeProvinces.length
    ? activeProvinces
        .map(
          (p) =>
            `<h3>Kebakaran aktif di ${esc(p)}</h3><table><thead><tr><th>Kebakaran</th><th>Kota terdampak (AQI US)</th></tr></thead><tbody>` +
            fires
              .filter((f) => f.affected.includes(p))
              .map(
                (f) =>
                  `<tr><td>${esc(f.name)}</td><td>${f.cities
                    .map((c) => `${esc(c.name)}${chip(c.aqi)}`)
                    .join("")}</td></tr>`
              )
              .join("") +
            "</tbody></table>"
        )
        .join("")
    : '<p class="empty" style="padding: 1rem 0;">Data rekapitulasi kebakaran per provinsi belum tersedia.</p>';
}

// ==========================================
// LEGENDA AQI
// ==========================================

$("#legend").innerHTML = LEVELS.map(
  (x) =>
    `<div style="--c:${x.c};--fg:${x.fg || "#fff"}"><b>${
      x.max === Infinity ? "301+" : "≤ " + x.max
    }</b>${x.l}</div>`
).join("");

// ==========================================
// INTERAKSI PETA
// ==========================================

function mark(id) {
  document
    .querySelectorAll(".fire-list button")
    .forEach((b) =>
      b.setAttribute("aria-current", b.dataset.id === id)
    );
}

function focusFire(id) {
  const f = fires.find((x) => x.id === id);

  if (!f) return;

  mark(id);

  map.flyTo([f.lat, f.lng], 7, { duration: 1 });

  if (markers[id]) {
    markers[id].openPopup();
  }

  if (window.innerWidth <= 900) {
    $("#map").scrollIntoView({ behavior: "smooth" });
  }
}

// ==========================================
// MODAL DETAIL PETA
// ==========================================

const detailModal = $("#detail-modal");

function openDetailModal(id) {
  const f = fires.find((x) => x.id === id);

  if (!f || !f.cities || !f.cities.length) {
    return;
  }

  const top = lv(worst(f));

  $("#modal-body").innerHTML =
    `<h3 id="modal-title">${esc(f.name)}</h3><p class="sub">${esc(f.province)} · ${f.lat.toFixed(2)}, ${f.lng.toFixed(2)}</p>
    <table><thead><tr><th>Kota terdampak</th><th>AQI US</th></tr></thead><tbody>${f.cities
      .map(
        (c) =>
          `<tr><td>${esc(c.name)}</td><td>${chip(c.aqi)}${lv(c.aqi).l}</td></tr>`
      )
      .join("")}</tbody></table>
    <p class="advice" style="--c:${top.c}">${top.t}</p>`;

  detailModal.classList.add("open");
  $("#modal-close").focus();
}

const closeDetailModal = () =>
  detailModal.classList.remove("open");

$("#modal-close").onclick = closeDetailModal;

detailModal.onclick = (e) => {
  if (e.target === detailModal) {
    closeDetailModal();
  }
};

// ==========================================
// MODAL EDUKASI
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

window.addEventListener("click", function (event) {
  if (event.target.classList.contains("edu-modal-overlay")) {
    event.target.classList.remove("active");
    document.body.style.overflow = "auto";
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeDetailModal();

    document
      .querySelectorAll(".edu-modal-overlay.active")
      .forEach((modal) => {
        modal.classList.remove("active");
        document.body.style.overflow = "auto";
      });
  }
});

// ==========================================
// EVENT DAFTAR KEBAKARAN DAN PROVINSI
// ==========================================

$("#fire-list").addEventListener("click", (e) => {
  const b = e.target.closest("button");

  if (b) {
    focusFire(b.dataset.id);
  }
});

$("#province-grid").addEventListener("click", (e) => {
  const b = e.target.closest("button.has");

  if (!b) return;

  const f = fires.find((x) => x.affected.includes(b.dataset.p));

  if (!f) return;

  $("#peta").scrollIntoView();
  focusFire(f.id);
});

// ==========================================
// TOGGLE LAYER PETA
// ==========================================

$("#toggle-aqi").onchange = (e) => {
  if (e.target.checked) {
    cityLayer.addTo(map);
  } else {
    map.removeLayer(cityLayer);
  }
};

$("#toggle-hotspot").onchange = (e) => {
  if (e.target.checked) {
    hotspotLayer.addTo(map);
  } else {
    map.removeLayer(hotspotLayer);
  }
};

const toggleDistrict = $("#toggle-district");
if (toggleDistrict) {
  toggleDistrict.onchange = (e) => {
    if (e.target.checked) {
      districtLayer.addTo(map);
      if (map.getZoom() >= 9) {
        districtLabelLayer.addTo(map);
        updateDistrictLabels();
      }
    } else {
      map.removeLayer(districtLayer);
      map.removeLayer(districtLabelLayer);
    }
  };
}

// ==========================================
// PENCARIAN KECAMATAN & INTERAKSI PETA
// ==========================================

function selectDistrictByGid(gid_3) {
  const item = districtIndex.find((d) => d.gid_3 === gid_3);
  if (!item) return;

  if (item.bounds) {
    map.fitBounds(item.bounds, { padding: [50, 50], maxZoom: 12 });
  } else if (item.center) {
    map.flyTo(item.center, 11);
  }

  if (item.layer) {
    item.layer.setStyle({
      weight: 3.5,
      color: "#f59e0b",
      fillColor: "#fbbf24",
      fillOpacity: 0.35,
    });
    setTimeout(() => {
      districtLayer.resetStyle(item.layer);
    }, 3000);
  }

  openDistrictSummary(item.properties, item.center);

  const dropdown = $("#search-dropdown");
  if (dropdown) dropdown.style.display = "none";

  if (window.innerWidth <= 900) {
    $("#peta").scrollIntoView({ behavior: "smooth" });
  }
}

function renderSearchDropdown(val) {
  const dropdown = $("#search-dropdown");
  if (!dropdown) return;

  if (!val || val.length < 2) {
    dropdown.style.display = "none";
    dropdown.innerHTML = "";
    return;
  }

  const term = val.toLowerCase();
  const matches = districtIndex.filter(
    (d) =>
      d.name.toLowerCase().includes(term) ||
      d.regency.toLowerCase().includes(term) ||
      d.province.toLowerCase().includes(term)
  ).slice(0, 6);

  if (!matches.length) {
    dropdown.innerHTML = `<div style="padding: 0.65rem 0.85rem; font-size: 0.82rem; color: var(--mute);">Tidak ada kecamatan yang cocok</div>`;
    dropdown.style.display = "block";
    return;
  }

  dropdown.innerHTML = matches
    .map(
      (d) =>
        `<button type="button" class="search-dropdown-item" data-gid="${esc(d.gid_3)}"><div><strong>${esc(d.name)}</strong><small>${esc(d.regency)}, ${esc(d.province)}</small></div><span class="badge-type">Kecamatan</span></button>`
    )
    .join("");
  dropdown.style.display = "block";
}

function drawDistrictSearchResults(val) {
  if (!val || val.length < 2) {
    drawList();
    return;
  }

  const term = val.toLowerCase();
  const matches = districtIndex.filter(
    (d) =>
      d.name.toLowerCase().includes(term) ||
      d.regency.toLowerCase().includes(term) ||
      d.province.toLowerCase().includes(term)
  );

  const fireList = $("#fire-list");
  if (!fireList) return;

  if (!matches.length) {
    fireList.innerHTML = `<li class="empty">Tidak ditemukan kecamatan yang cocok dengan “${esc(val)}”.</li>`;
    return;
  }

  fireList.innerHTML =
    `<li class="search-summary-item">Ditemukan <b>${matches.length}</b> wilayah untuk “${esc(val)}”:</li>` +
    matches
      .slice(0, 25)
      .map(
        (d) =>
          `<li><button type="button" class="district-search-item" data-gid="${esc(d.gid_3)}"><span><strong>${esc(d.name)}</strong><small>${esc(d.regency)}, ${esc(d.province)}</small></span><span class="badge-zoom">Buka</span></button></li>`
      )
      .join("") +
    (matches.length > 25
      ? `<li class="empty" style="font-size: 0.78rem; text-align: center;">Dan ${matches.length - 25} wilayah lainnya. Persempit kata kunci pencarian.</li>`
      : "");
}

// ==========================================
// MUAT ULANG DAN PENCARIAN
// ==========================================

$("#refresh").onclick = load;

$("#search-box").addEventListener("input", (e) => {
  const val = e.target.value.trim();
  query = val.toLowerCase();
  renderSearchDropdown(val);
  drawDistrictSearchResults(val);
  drawMap();
});

$("#search-box").addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    const firstItem = $("#search-dropdown button[data-gid]");
    if (firstItem) {
      selectDistrictByGid(firstItem.dataset.gid);
    }
  }
});

const searchDropdown = $("#search-dropdown");
if (searchDropdown) {
  searchDropdown.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-gid]");
    if (btn) {
      selectDistrictByGid(btn.dataset.gid);
    }
  });
}

$("#fire-list").addEventListener("click", (e) => {
  const districtBtn = e.target.closest("button.district-search-item[data-gid]");
  if (districtBtn) {
    selectDistrictByGid(districtBtn.dataset.gid);
    return;
  }
  const b = e.target.closest("button[data-id]");
  if (b) {
    focusFire(b.dataset.id);
  }
});

// ==========================================
// NAVBAR
// ==========================================

const nav = $("#navbar-nav");
const searchForm = $("#search-form");

$("#hamburger-menu").onclick = () =>
  nav.classList.toggle("active");

$("#search-button").onclick = () => {
  searchForm.classList.toggle("active");
  $("#search-box").focus();
};

document.addEventListener("click", (e) => {
  if (!e.target.closest("#hamburger-menu, #navbar-nav")) {
    nav.classList.remove("active");
  }

  if (!e.target.closest("#search-button, #search-form")) {
    searchForm.classList.remove("active");
  }

  if (!e.target.closest("#search-form")) {
    const dropdown = $("#search-dropdown");
    if (dropdown) dropdown.style.display = "none";
  }
});

// ==========================================
// FORM LAPORAN
// Belum tersambung ke endpoint backend.
// ==========================================

$("#report-form").addEventListener("submit", (e) => {
  e.preventDefault();

  $("#report-status").textContent =
    "Form laporan belum terhubung ke backend.";

  e.target.reset();
});

// ==========================================
// EVENT LISTENER MODE SIMULASI & HORIZON
// ==========================================

const btnDb = $("#btn-mode-db");
const btnSim = $("#btn-mode-sim");
if (btnDb) {
  btnDb.addEventListener("click", () => switchDataMode("database"));
}
if (btnSim) {
  btnSim.addEventListener("click", () => switchDataMode("simulation"));
}

document.querySelectorAll(".horizon-btn").forEach((btn) => {
  btn.addEventListener("click", (e) => {
    const h = parseInt(e.currentTarget.dataset.horizon, 10);
    if (h) setSimulationHorizon(h);
  });
});

// ==========================================
// MULAI APLIKASI
// ==========================================

if (currentDataMode === "simulation") {
  switchDataMode("simulation");
} else {
  load();
}
