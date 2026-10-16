/*
  Berita & Peringatan
  Lapisan 1: "Cek lokasi saya" (jarak ke titik api dan kota terdekat)
  Lapisan 2: papan peringatan bertingkat dengan filter

  Dipasang tanpa mengubah script.js: file ini membungkus fetchFireData() dan
  merender setelah data siap. Letakkan di antara data.js dan script.js.
  Hasil dihitung otomatis dari data di situs, bukan pengumuman resmi.
*/
const SIAGA = {
  NEAR_FIRE_KM: 25, // di bawah jarak ini, peringatan berubah menjadi "titik api sangat dekat"
  MAX_CITY_KM: 150, // kota yang lebih jauh dari ini tidak dipakai untuk memperkirakan udara Anda
};

(function () {
  var q = function (s) {
    return document.querySelector(s);
  };
  var data = null,
    filter = "all",
    userLayer = null,
    bound = false,
    last = null;
  var T = Math.PI / 180;

  function km(a, b, c, d) {
    var dl = (c - a) * T,
      dg = (d - b) * T;
    var h =
      Math.pow(Math.sin(dl / 2), 2) +
      Math.cos(a * T) * Math.cos(c * T) * Math.pow(Math.sin(dg / 2), 2);
    return 2 * 6371 * Math.asin(Math.sqrt(h));
  }
  function arah(a, b, c, d) {
    var y = Math.sin((d - b) * T) * Math.cos(c * T);
    var x =
      Math.cos(a * T) * Math.sin(c * T) -
      Math.sin(a * T) * Math.cos(c * T) * Math.cos((d - b) * T);
    var deg = (Math.atan2(y, x) / T + 360) % 360;
    return [
      "utara",
      "timur laut",
      "timur",
      "tenggara",
      "selatan",
      "barat daya",
      "barat",
      "barat laut",
    ][Math.round(deg / 45) % 8];
  }
  var lvIdx = function (v) {
    return LEVELS.findIndex(function (x) {
      return v <= x.max;
    });
  };
  var round = function (n) {
    return n < 10
      ? n.toFixed(1).replace(".", ",")
      : Math.round(n).toLocaleString("id-ID");
  };

  /* ---------- Lapisan 2: papan peringatan ---------- */
  function renderBoard() {
    if (!data || !data.fires || !data.fires.length) {
      q("#alert-filters").innerHTML = "";
      q("#alerts").innerHTML =
        '<li class="empty">Data peringatan risiko dan kualitas udara belum tersedia dari API/model ML.</li>';
      return;
    }
    var fs = data.fires.slice().sort(function (a, b) {
      return worst(b) - worst(a);
    });
    var counts = {};
    fs.forEach(function (f) {
      var i = lvIdx(worst(f));
      counts[i] = (counts[i] || 0) + 1;
    });

    q("#alert-filters").innerHTML =
      '<button type="button" class="fchip" data-lv="all" aria-pressed="' +
      (filter === "all") +
      '">Semua (' +
      fs.length +
      ")</button>" +
      Object.keys(counts)
        .sort(function (a, b) {
          return b - a;
        })
        .map(function (i) {
          var L = LEVELS[i];
          return (
            '<button type="button" class="fchip" data-lv="' +
            i +
            '" aria-pressed="' +
            (filter === String(i)) +
            '"><span class="dot" style="background:' +
            L.c +
            '"></span>' +
            L.l +
            " (" +
            counts[i] +
            ")</button>"
          );
        })
        .join("");

    var shown = fs.filter(function (f) {
      return filter === "all" || String(lvIdx(worst(f))) === filter;
    });
    q("#alerts").innerHTML =
      shown
        .map(function (f) {
          var L = lv(worst(f));
          return (
            '<li class="alert" style="--c:' +
            L.c +
            '"><div class="alert-main">' +
            '<span class="badge" style="--c:' +
            L.c +
            ";--fg:" +
            (L.fg || "#fff") +
            '">' +
            L.l +
            "</span>" +
            "<h3>" +
            esc(f.name) +
            "</h3><p>" +
            esc(f.province) +
            "</p>" +
            '<p class="alert-act">' +
            L.t +
            "</p></div>" +
            '<div class="alert-side"><div class="cities">' +
            f.cities
              .map(function (c) {
                return "<span>" + esc(c.name) + chip(c.aqi) + "</span>";
              })
              .join("") +
            "</div>" +
            '<button type="button" class="link" data-id="' +
            f.id +
            '">Lihat di peta</button></div></li>'
          );
        })
        .join("") ||
      '<li class="empty">Tidak ada daerah pada tingkat ini.</li>';
  }

  /* ---------- Lapisan 1: cek lokasi ---------- */
  function buildPicker() {
    if (!data || !data.fires || !data.fires.length) {
      q("#loc-pick").innerHTML =
        '<option value="">Data stasiun kota belum tersedia</option>';
      return;
    }
    var rows = [];
    data.fires.forEach(function (f) {
      f.cities.forEach(function (c) {
        rows.push({
          n: c.name + " (" + f.province + ")",
          lat: c.lat,
          lng: c.lng,
        });
      });
    });
    rows.sort(function (a, b) {
      return a.n.localeCompare(b.n, "id");
    });
    q("#loc-pick").innerHTML =
      '<option value="">Pilih kota…</option>' +
      rows
        .map(function (r, i) {
          return (
            '<option value="' +
            r.lat +
            "," +
            r.lng +
            '">' +
            esc(r.n) +
            "</option>"
          );
        })
        .join("");
  }

  function check(lat, lng) {
    if (!data || !data.fires || !data.fires.length) {
      q("#loc-status").textContent = "";
      q("#loc-result").innerHTML =
        '<div class="loc-card" style="--c:#566359"><p class="loc-verdict">' +
        "Data titik api dan kualitas udara aktual belum tersedia dari database. Lokasi Anda: " +
        lat.toFixed(4) +
        ", " +
        lng.toFixed(4) +
        ". Jarak ke kebakaran belum dapat dihitung." +
        "</p></div>";
      return;
    }
    var fs = data.fires
      .map(function (f) {
        return { f: f, d: km(lat, lng, f.lat, f.lng) };
      })
      .sort(function (a, b) {
        return a.d - b.d;
      });
    var cs = [];
    data.fires.forEach(function (f) {
      f.cities.forEach(function (c) {
        cs.push({ c: c, d: km(lat, lng, c.lat, c.lng) });
      });
    });
    cs.sort(function (a, b) {
      return a.d - b.d;
    });
    var nf = fs[0],
      nc = cs[0],
      color,
      verdict;

    if (nf.d <= SIAGA.NEAR_FIRE_KM) {
      color = LEVELS[5].c;
      verdict =
        "Titik api sangat dekat dengan Anda. Ikuti arahan BPBD dan pemerintah daerah setempat, dan siapkan kemungkinan evakuasi.";
    } else if (nc.d <= SIAGA.MAX_CITY_KM) {
      var L = lv(nc.c.aqi);
      color = L.c;
      verdict =
        "Udara di sekitar Anda diperkirakan " + L.l.toLowerCase() + ". " + L.t;
    } else {
      color = "#566359";
      verdict =
        "Tidak ada stasiun udara dalam radius " +
        SIAGA.MAX_CITY_KM +
        " km dari Anda pada data ini, jadi kualitas udara Anda belum bisa diperkirakan. Cek kondisi udara setempat.";
    }
    last = { lat: lat, lng: lng, nf: nf };
    q("#loc-status").textContent = "";
    q("#loc-result").innerHTML =
      '<div class="loc-card" style="--c:' +
      color +
      '"><p class="loc-verdict">' +
      verdict +
      "</p><dl>" +
      "<div><dt>Titik api terdekat</dt><dd><b>" +
      esc(nf.f.name) +
      "</b>, " +
      esc(nf.f.province) +
      "<br>sekitar " +
      round(nf.d) +
      " km ke arah " +
      arah(lat, lng, nf.f.lat, nf.f.lng) +
      "</dd></div>" +
      "<div><dt>Kota terdekat dengan data udara</dt><dd><b>" +
      esc(nc.c.name) +
      "</b> " +
      chip(nc.c.aqi) +
      " " +
      lv(nc.c.aqi).l +
      "<br>sekitar " +
      round(nc.d) +
      " km</dd></div></dl>" +
      '<button type="button" class="btn" id="loc-map">Lihat di peta</button>' +
      '<a class="btn ghost" target="_blank" rel="noopener" href="https://wa.me/?text=' +
      encodeURIComponent(
        "Siaga Api: titik api terdekat " +
          nf.f.name +
          ", " +
          nf.f.province +
          " sekitar " +
          round(nf.d) +
          " km. Udara kota terdekat (" +
          nc.c.name +
          "): AQI " +
          nc.c.aqi +
          " (" +
          lv(nc.c.aqi).l +
          "). " +
          verdict +
          " " +
          location.href,
      ) +
      '">Bagikan ke WhatsApp</a>' +
      '<p class="loc-note">Jarak garis lurus (perkiraan), bukan rute evakuasi. Hasil dihitung otomatis dari data di situs ini dan bukan pengumuman resmi pemerintah. Lokasi Anda diproses di browser dan tidak dikirim ke server.</p></div>';
  }

  function showOnMap() {
    if (!last) return;
    if (userLayer) map.removeLayer(userLayer);
    var f = last.nf.f;
    userLayer = L.layerGroup([
      L.polyline(
        [
          [last.lat, last.lng],
          [f.lat, f.lng],
        ],
        { color: "#c93f0a", weight: 2, dashArray: "6 6" },
      ),
      L.circleMarker([last.lat, last.lng], {
        radius: 8,
        color: "#fff",
        weight: 2,
        fillColor: "#1d6fd8",
        fillOpacity: 1,
      }).bindTooltip("Lokasi Anda"),
    ]).addTo(map);
    q("#peta").scrollIntoView();
    map.fitBounds(
      [
        [last.lat, last.lng],
        [f.lat, f.lng],
      ],
      { padding: [70, 70], maxZoom: 9 },
    );
    if (typeof markers !== "undefined" && markers[f.id])
      markers[f.id].openPopup();
  }

  function locate() {
    q("#loc-result").innerHTML = "";
    if (!navigator.geolocation) {
      q("#loc-status").textContent =
        "Browser Anda tidak mendukung lokasi. Pilih kota dari daftar.";
      return;
    }
    q("#loc-status").textContent = "Mencari lokasi Anda…";
    navigator.geolocation.getCurrentPosition(
      function (p) {
        check(p.coords.latitude, p.coords.longitude);
      },
      function (e) {
        q("#loc-status").textContent =
          (e.code === 1
            ? "Izin lokasi ditolak."
            : "Lokasi belum bisa ditentukan.") +
          " Pilih kota dari daftar sebagai gantinya.";
      },
      { timeout: 10000, maximumAge: 300000 },
    );
  }

  function bind() {
    if (bound) return;
    bound = true;
    q("#loc-btn").onclick = locate;
    q("#loc-pick").onchange = function (e) {
      if (e.target.value) {
        var p = e.target.value.split(",");
        check(+p[0], +p[1]);
      }
    };
    q("#loc-result").addEventListener("click", function (e) {
      if (e.target.id === "loc-map") showOnMap();
    });
    q("#alert-filters").addEventListener("click", function (e) {
      var b = e.target.closest("button");
      if (!b) return;
      filter = b.dataset.lv;
      renderBoard();
    });
    q("#alerts").addEventListener("click", function (e) {
      var b = e.target.closest("button[data-id]");
      if (!b) return;
      q("#peta").scrollIntoView();
      focusFire(b.dataset.id);
    });
  }

  /* ---------- Area udara berbahaya di peta ---------- */
  var ZONA = {
    MIN_AQI: 100, // zona hanya digambar bila AQI terburuk di atas angka ini
    KM: [
      [150, 25],
      [200, 40],
      [300, 60],
      [Infinity, 80],
    ], // radius perkiraan menurut AQI
  };
  var zoneLayer = null;

  function zoneKm(v) {
    for (var i = 0; i < ZONA.KM.length; i++)
      if (v <= ZONA.KM[i][0]) return ZONA.KM[i][1];
  }

  function drawZones() {
    if (typeof map === "undefined" || !data) return;
    if (!map.getPane("zona")) {
      map.createPane("zona");
      map.getPane("zona").style.zIndex = 350;
    }
    if (zoneLayer) map.removeLayer(zoneLayer);
    zoneLayer = L.layerGroup();
    var list = typeof visible === "function" ? visible() : data.fires;
    if (!list || !list.length) return;
    list.forEach(function (f) {
      var a = worst(f);
      if (a <= ZONA.MIN_AQI) return;
      var op = a > 300 ? 0.45 : a > 200 ? 0.38 : a > 150 ? 0.3 : 0.22;
      L.circle([f.lat, f.lng], {
        pane: "zona",
        radius: zoneKm(a) * 1000,
        interactive: false,
        color: "#b00020",
        weight: 1.5,
        dashArray: "4 4",
        fillColor: "#d62828",
        fillOpacity: op,
      }).addTo(zoneLayer);
    });
    var t = q("#toggle-zone");
    if (!t || t.checked) zoneLayer.addTo(map);
  }

  /* ---------- A. Berita ---------- */
  var topic = "all";
  function renderNews() {
    var items = (data && data.news) || [];
    if (!items.length) {
      q("#news-topics").innerHTML = "";
      q("#news").innerHTML =
        '<p class="empty">Belum ada berita aktual dari feed API. Data berita akan muncul saat feed eksternal terhubung.</p>';
      return;
    }
    var counts = {};
    items.forEach(function (n) {
      (n.tags || []).forEach(function (t) {
        counts[t] = (counts[t] || 0) + 1;
      });
    });
    var tags = Object.keys(counts).sort(function (a, b) {
      return counts[b] - counts[a];
    });
    q("#news-topics").innerHTML = ["all"]
      .concat(tags)
      .map(function (t) {
        return (
          '<button type="button" class="tchip" data-t="' +
          esc(t) +
          '" aria-pressed="' +
          (topic === t) +
          '">' +
          (t === "all" ? "Semua" : esc(t)) +
          "</button>"
        );
      })
      .join("");
    var shown = items.filter(function (n) {
      return topic === "all" || (n.tags || []).indexOf(topic) > -1;
    });
    q("#news").innerHTML =
      shown
        .map(function (n) {
          var tg = n.tags || [],
            more =
              tg.length > 2
                ? '<span class="tag more">+' + (tg.length - 2) + "</span>"
                : "";
          var meta = [
            n.minutes ? n.minutes + " menit baca" : "",
            n.source ? esc(n.source) : "",
          ]
            .filter(Boolean)
            .join(" · ");
          return (
            '<article class="news-card"><a href="' +
            esc(n.url || "#") +
            '" target="_blank" rel="noopener"><img src="' +
            esc(n.image || "img/batuk.jpg") +
            '" alt="" loading="lazy" /><h4>' +
            esc(n.title) +
            "</h4></a>" +
            '<p class="mins">' +
            meta +
            "</p>" +
            '<div class="tags">' +
            tg
              .slice(0, 2)
              .map(function (t) {
                return '<span class="tag">' + esc(t) + "</span>";
              })
              .join("") +
            more +
            "</div></article>"
          );
        })
        .join("") ||
      '<p class="empty">' +
        (items.length
          ? "Belum ada berita untuk topik ini."
          : "Belum ada berita. Berita akan tampil di sini setelah sumber berita tersambung ke API.") +
        "</p>";
  }

  function render() {
    bind();
    renderBoard();
    buildPicker();
    drawZones();
    renderNews();
    var nt = q("#news-topics");
    if (nt && !nt.dataset.on) {
      nt.dataset.on = 1;
      nt.addEventListener("click", function (e) {
        var b = e.target.closest("button");
        if (b) {
          topic = b.dataset.t;
          renderNews();
        }
      });
    }
    var t = q("#toggle-zone"),
      s = q("#search-box");
    if (t && !t.dataset.on) {
      t.dataset.on = 1;
      t.onchange = drawZones;
    }
    if (s && !s.dataset.on) {
      s.dataset.on = 1;
      s.addEventListener("input", function () {
        setTimeout(drawZones, 0);
      });
    }
  }

  var orig = fetchFireData;
  fetchFireData = async function () {
    var d = await orig.apply(this, arguments);
    data = d;
    setTimeout(render, 0);
    return d;
  };
})();
