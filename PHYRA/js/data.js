/*
  LAPISAN DATA (fokus Pulau Kalimantan)
  Frontend hanya memanggil fetchFireData(). Saat backend siap:
  1) ubah CONFIG.USE_SAMPLE menjadi false
  2) isi CONFIG.API_URL dengan endpoint backend
  Respons API harus berbentuk sama dengan SAMPLE di bawah, termasuk
  "hotspots": [{ lat, lng }] untuk titik merah di peta (mis. dari SiPongi
  atau NASA FIRMS).
*/
const CONFIG = {
  USE_SAMPLE: true,
  API_URL: "/api/wildfires",
};

/*
  Data contoh Kalimantan, dirangkum dari pemberitaan 8–15 Okt 2026:
  - Hotspot per provinsi: SiPongi Kemenhut/BMKG via Liputan6, Medcom, Sultramedia.
  - AQI⁺ kota: IQAir via Mediakompeten (Palangka Raya, Banjarmasin, Pontianak,
    Sampit, Balikpapan, Samarinda). Kumai, Matangai, Kotabaru Hilir, dan Sebulu
    masih memakai nilai IQAir lama (11 Okt) dari data awal proyek: perlu diperbarui.
  - Luas terbakar 2026: Kalbar 48.536 ha, Kalsel 19.303 ha, Kaltim 5.761 ha
    (Katadata, awal Sep) + Kalteng 17.530 ha (Pemprov Kalteng, 8 Okt).
    Angka berbeda tanggal, jadi hanya indikatif.
  Koordinat adalah perkiraan, hanya untuk menampilkan peta.
  affected = provinsi yang terdampak (dipakai untuk hitungan per provinsi).
*/
const SAMPLE = {
  updatedAt: "2026-10-15T18:00:00+07:00",
  burnedHectares: 91130,
  news: [
    {
      title:
        "Kualitas udara Palangka Raya masih berbahaya, kasus ISPA tembus 101",
      source: "Kompas.com",
      url: "https://regional.kompas.com/read/2026/10/15/094202478/kualitas-udara-palangka-raya-masih-berbahaya-pm-25-tembus-8446-g-m-dan-ispa",
      image: "img/batuk.jpg",
      date: "2026-10-15",
      tags: ["Kualitas Udara", "Kesehatan", "Kalimantan Tengah"],
    },
    {
      title:
        "Sebaran titik api kebakaran hutan Kalimantan dan Sumatera hari ini",
      source: "Liputan6.com",
      url: "https://www.liputan6.com/news/read/8312894/sebaran-titik-api-kebakaran-hutan-kalimantan-dan-sumatera-hari-ini",
      image: "img/bumi.jpg",
      date: "2026-10-14",
      tags: ["Kebakaran Hutan", "Titik Panas", "Kalimantan Tengah"],
    },
    {
      title: "BNPB: 513,89 hektare lahan terbakar di Taman Nasional Tanjung Puting",
      source: "Okezone",
      url: "https://news.okezone.com/read/2026/10/13/337/3247556/karhutla-masih-meluas-bnpb-513-89-hektare-lahan-terbakar-di-taman-nasional-tanjung-puting",
      image: "img/pabrik.jpg",
      date: "2026-10-13",
      tags: ["Kebakaran Hutan", "Kalimantan Tengah"],
    },
    {
      title: "Karhutla di Kotawaringin Barat capai 2.887 hektare",
      source: "Radar Sampit",
      url: "https://radarsampit.jawapos.com/kotawaringin-barat/2610130026/karhutla-di-kotawaringin-barat-capai-2887-hektare",
      image: "img/bumi.jpg",
      date: "2026-10-12",
      tags: ["Kebakaran Hutan", "Gambut", "Kalimantan Tengah"],
    },
    {
      title: "Akibat karhutla, 7 individu orangutan diselamatkan di Ketapang",
      source: "Mongabay Indonesia",
      url: "https://mongabay.co.id/2026/09/03/akibat-karhutla-7-individu-orangutan-kalimantan-diselamatkan-di-ketapang/",
      image: "img/bumi.jpg",
      date: "2026-09-03",
      tags: ["Kebakaran Hutan", "Satwa", "Kalimantan Barat"],
    },
    {
      title: "Kabut asap Banjarbaru tiga bulan, 127 rumah oksigen diaktifkan",
      source: "ANTARA",
      url: "https://jogja.antaranews.com/berita/855183/udara-segar-yang-dirindukan",
      image: "img/batuk.jpg",
      date: "2026-09-20",
      tags: ["Kualitas Udara", "Kesehatan", "Kalimantan Selatan"],
    },
  ],
  fires: [
    {
      id: "palangka-raya",
      name: "Kota Palangka Raya",
      province: "Kalimantan Tengah",
      affected: ["Kalimantan Tengah"],
      lat: -2.21,
      lng: 113.92,
      cities: [{ name: "Palangka Raya", aqi: 988, lat: -2.21, lng: 113.92 }],
    },
    {
      id: "kotawaringin-barat",
      name: "Kabupaten Kotawaringin Barat",
      province: "Kalimantan Tengah",
      affected: ["Kalimantan Tengah"],
      lat: -2.75,
      lng: 111.75,
      cities: [{ name: "Kumai", aqi: 923, lat: -2.73, lng: 111.73 }],
    },
    {
      id: "kotawaringin-timur",
      name: "Kabupaten Kotawaringin Timur",
      province: "Kalimantan Tengah",
      affected: ["Kalimantan Tengah"],
      lat: -2.4,
      lng: 112.9,
      cities: [{ name: "Sampit", aqi: 244, lat: -2.53, lng: 112.95 }],
    },
    {
      id: "kapuas",
      name: "Kabupaten Kapuas",
      province: "Kalimantan Tengah",
      affected: ["Kalimantan Tengah"],
      lat: -2.85,
      lng: 114.3,
      cities: [{ name: "Matangai", aqi: 278, lat: -2.5, lng: 114.1 }],
    },
    {
      id: "banjar",
      name: "Kabupaten Banjar",
      province: "Kalimantan Selatan",
      affected: ["Kalimantan Selatan"],
      lat: -3.35,
      lng: 114.95,
      cities: [{ name: "Banjarmasin", aqi: 378, lat: -3.32, lng: 114.59 }],
    },
    {
      id: "kotabaru",
      name: "Kabupaten Kotabaru",
      province: "Kalimantan Selatan",
      affected: ["Kalimantan Selatan"],
      lat: -3.2,
      lng: 116.2,
      cities: [{ name: "Kotabaru Hilir", aqi: 85, lat: -3.25, lng: 116.22 }],
    },
    {
      id: "kubu-raya",
      name: "Kabupaten Kubu Raya",
      province: "Kalimantan Barat",
      affected: ["Kalimantan Barat"],
      lat: -0.35,
      lng: 109.45,
      cities: [{ name: "Pontianak", aqi: 252, lat: -0.03, lng: 109.33 }],
    },
    {
      id: "kutai-kartanegara",
      name: "Kabupaten Kutai Kartanegara",
      province: "Kalimantan Timur",
      affected: ["Kalimantan Timur"],
      lat: -0.45,
      lng: 116.85,
      cities: [
        { name: "Sebulu", aqi: 82, lat: -0.42, lng: 116.95 },
        { name: "Samarinda", aqi: 72, lat: -0.5, lng: 117.15 },
        { name: "Balikpapan", aqi: 153, lat: -1.24, lng: 116.83 },
      ],
    },
  ],
};

/*
  Titik merah di peta (hotspot). Selama USE_SAMPLE aktif, posisinya dibuat
  dari gugus per kabupaten dengan jumlah mengikuti proporsi hotspot SiPongi
  14 Okt 2026 (Kalteng jauh paling banyak, lalu Kalsel, Kalbar, Kaltim).
  Ini ILUSTRASI sebaran, bukan koordinat satelit asli. Saat API siap,
  isi SAMPLE.hotspots dari data nyata.
*/
(function () {
  // [lat, lng, sebaran (derajat), jumlah titik]
  const CLUSTERS = [
    // Kalimantan Tengah
    [-2.4, 111.2, 0.3, 14], // Sukamara, Lamandau
    [-2.75, 111.75, 0.3, 34], // Kotawaringin Barat
    [-2.8, 112.3, 0.25, 22], // Seruyan, Tanjung Puting
    [-2.3, 112.9, 0.4, 50], // Kotawaringin Timur
    [-1.95, 113.4, 0.35, 50], // Katingan
    [-2.4, 114.0, 0.3, 50], // Palangka Raya, Pulang Pisau
    [-2.9, 114.4, 0.35, 36], // Kapuas
    [-1.9, 114.8, 0.3, 10], // Barito Selatan, Utara
    // Kalimantan Selatan
    [-3.2, 114.95, 0.3, 20], // Banjar, Tapin, Barito Kuala
    [-3.75, 114.85, 0.2, 8], // Tanah Laut
    [-2.4, 115.4, 0.3, 7], // Tabalong, Hulu Sungai
    [-3.2, 116.0, 0.25, 5], // Kotabaru
    // Kalimantan Barat
    [-1.8, 110.5, 0.4, 14], // Ketapang
    [-0.9, 109.7, 0.25, 8], // Kayong Utara, Kubu Raya
    [0.1, 110.6, 0.3, 6], // Sanggau
    [-0.35, 112.0, 0.45, 8], // Sintang, Melawi
    [0.85, 109.3, 0.2, 4], // Sambas, Mempawah
    // Kalimantan Timur
    [-0.5, 116.8, 0.35, 10], // Kutai Kartanegara
    [0.8, 117.4, 0.3, 8], // Kutai Timur
    [-1.5, 116.2, 0.25, 6], // Paser, Penajam
    [1.7, 117.3, 0.25, 4], // Berau
    // Kalimantan Utara
    [3.1, 116.4, 0.3, 2],
    [3.9, 117.5, 0.2, 2],
  ];

  // Garis besar kasar Kalimantan (wilayah Indonesia) agar titik tidak jatuh di laut
  const LAND = [
    [109.65, 2.08], [110.5, 1.7], [111.1, 1.4], [111.8, 1.3], [112.5, 1.5],
    [113.6, 1.4], [114.6, 2.0], [115.5, 3.9], [117.0, 4.2], [117.8, 4.2],
    [117.6, 3.3], [117.5, 2.0], [118.2, 2.3], [118.9, 1.0], [117.6, 0.1],
    [117.2, -1.2], [116.7, -1.5], [116.3, -1.9], [116.0, -3.0], [116.1, -4.0],
    [115.4, -3.9], [114.6, -4.0], [114.5, -3.5], [113.9, -3.3], [113.0, -3.4],
    [112.0, -3.3], [111.1, -3.0], [110.0, -2.9], [110.0, -1.9], [109.9, -1.4],
    [109.3, -0.9], [109.0, -0.1], [108.9, 0.6], [109.0, 1.5],
  ];
  const inLand = (lat, lng) => {
    let inside = false;
    for (let i = 0, j = LAND.length - 1; i < LAND.length; j = i++) {
      const [xi, yi] = LAND[i],
        [xj, yj] = LAND[j];
      if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi)
        inside = !inside;
    }
    return inside;
  };

  // Pengacak tetap supaya titik tidak berpindah setiap muat ulang
  let seed = 2026;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  const gauss = () =>
    Math.sqrt(-2 * Math.log(rnd() + 1e-9)) * Math.cos(2 * Math.PI * rnd());

  const pts = [];
  CLUSTERS.forEach(([lat, lng, s, n]) => {
    let made = 0,
      tries = 0;
    while (made < n && tries++ < n * 40) {
      const la = lat + gauss() * s,
        ln = lng + gauss() * s;
      if (!inLand(la, ln)) continue;
      pts.push({ lat: +la.toFixed(3), lng: +ln.toFixed(3) });
      made++;
    }
  });
  SAMPLE.hotspots = pts;
})();

const PROVINCES = [
  "Kalimantan Barat",
  "Kalimantan Tengah",
  "Kalimantan Selatan",
  "Kalimantan Timur",
  "Kalimantan Utara",
];

async function fetchFireData() {
  if (CONFIG.USE_SAMPLE) return SAMPLE;
  const res = await fetch(CONFIG.API_URL);
  if (!res.ok) throw new Error("HTTP " + res.status);
  return res.json();
}
