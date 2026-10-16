/*
  Lapor warga: jenis laporan, lokasi GPS, foto, antrean offline, dan pelacak status.
  Letakkan SEBELUM script.js agar form ini menggantikan handler lama.

  Backend: isi REPORT_URL dengan endpoint POST (JSON). Selama masih null,
  situs berjalan dalam mode demo: laporan hanya tersimpan di perangkat dan
  alur status ditampilkan sebagai simulasi.
*/
(function () {
  var REPORT_URL = null;
  var KEY = "siaga_laporan";
  var STEPS = [
    "Tersimpan di perangkat",
    "Terkirim",
    "Diverifikasi petugas",
    "Ditindaklanjuti",
  ];
  var JENIS = {
    api: "Api atau asap",
    lahan: "Pembukaan atau alih fungsi lahan",
    gambut: "Gambut kering atau terbakar",
  };
  var form = document.getElementById("report-form");
  if (!form) return;
  var q = function (s) {
    return document.querySelector(s);
  };
  var photo = null;

  function read() {
    try {
      return JSON.parse(localStorage.getItem(KEY)) || [];
    } catch (e) {
      return [];
    }
  }
  function write(a) {
    try {
      localStorage.setItem(KEY, JSON.stringify(a));
    } catch (e) {
      /* penyimpanan penuh */
    }
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      }[c];
    });
  }

  function track(r) {
    var demo = !REPORT_URL;
    q("#report-track").innerHTML =
      '<div class="trk-card"><h4>Laporan ' +
      esc(r.id) +
      ": " +
      esc(JENIS[r.jenis]) +
      "</h4>" +
      '<ol class="trk">' +
      STEPS.map(function (s, i) {
        return (
          '<li class="' +
          (i < r.step ? "done" : i === r.step ? "now" : "") +
          '"><span>' +
          (i + 1) +
          "</span>" +
          s +
          "</li>"
        );
      }).join("") +
      "</ol>" +
      '<p class="trk-note">' +
      (demo
        ? "Mode demo: belum terhubung ke server petugas. Langkah setelah &ldquo;Tersimpan&rdquo; adalah simulasi alur."
        : r.step === 0
          ? "Menunggu koneksi. Laporan akan dikirim otomatis."
          : "Laporan Anda sudah diterima sistem.") +
      "</p></div>";
  }

  function simulate(r, all) {
    var t = setInterval(function () {
      if (r.step >= 3) {
        clearInterval(t);
        return;
      }
      r.step++;
      write(all);
      track(r);
    }, 1800);
  }

  function flush() {
    if (!REPORT_URL || !navigator.onLine) return;
    var all = read();
    all
      .filter(function (r) {
        return r.step === 0;
      })
      .forEach(function (r) {
        fetch(REPORT_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(r),
        })
          .then(function (res) {
            if (!res.ok) throw new Error(res.status);
            r.step = 1;
            write(all);
            track(r);
          })
          .catch(function () {
            /* coba lagi saat online */
          });
      });
  }

  function net() {
    q("#net-note").hidden = navigator.onLine;
  }
  window.addEventListener("online", function () {
    net();
    flush();
  });
  window.addEventListener("offline", net);
  net();

  q("#loc-gps").onclick = function () {
    var st = q("#report-status");
    if (!navigator.geolocation) {
      st.textContent =
        "Browser tidak mendukung lokasi. Isi lokasi secara manual.";
      return;
    }
    st.textContent = "Mencari lokasi…";
    navigator.geolocation.getCurrentPosition(
      function (p) {
        form.elements.lokasi.value =
          p.coords.latitude.toFixed(5) + ", " + p.coords.longitude.toFixed(5);
        st.textContent = "Lokasi terisi. Tambahkan nama desa bila perlu.";
      },
      function () {
        st.textContent =
          "Lokasi belum bisa ditentukan. Isi lokasi secara manual.";
      },
      { timeout: 10000 },
    );
  };

  q("#photo").onchange = function (e) {
    var f = e.target.files[0],
      prev = q("#photo-prev");
    if (!f) {
      photo = null;
      prev.hidden = true;
      return;
    }
    var rd = new FileReader();
    rd.onload = function () {
      var im = new Image();
      im.onload = function () {
        var s = Math.min(1, 800 / Math.max(im.width, im.height)),
          c = document.createElement("canvas");
        c.width = Math.round(im.width * s);
        c.height = Math.round(im.height * s);
        c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
        photo = c.toDataURL("image/jpeg", 0.7);
        prev.src = photo;
        prev.hidden = false;
      };
      im.src = rd.result;
    };
    rd.readAsDataURL(f);
  };

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    e.stopImmediatePropagation();
    var d = form.elements;
    var r = {
      id: "#" + Date.now().toString(36).slice(-5).toUpperCase(),
      jenis: d.jenis.value,
      nama: d.nama.value,
      hp: d.hp.value,
      lokasi: d.lokasi.value,
      deskripsi: d.deskripsi.value,
      foto: photo,
      waktu: new Date().toISOString(),
      step: 0,
    };
    var all = read();
    all.push(r);
    write(all);
    track(r);
    q("#report-status").textContent =
      "Laporan disimpan. Terima kasih sudah ikut menjaga lingkungan.";
    form.reset();
    photo = null;
    q("#photo-prev").hidden = true;
    if (REPORT_URL) flush();
    else simulate(r, all);
  });
})();
