/*
  LAPISAN DATA
  Frontend hanya memanggil fetchFireData(). Saat backend siap:
  1) ubah CONFIG.USE_SAMPLE menjadi false
  2) isi CONFIG.API_URL dengan endpoint backend
  Respons API harus berbentuk sama dengan SAMPLE di bawah.
*/
const CONFIG = {
  USE_SAMPLE: true,
  API_URL: '/api/wildfires'
};

/*
  Data contoh: daftar kebakaran dan nilai AQI diambil dari halaman IQAir Indonesia
  (11 Okt 2026, 00.35). Koordinat adalah perkiraan, hanya untuk menampilkan peta.
  affected = provinsi yang terdampak (dipakai untuk hitungan per provinsi).
*/
const SAMPLE = {
  updatedAt: '2026-10-11T00:35:00+07:00',
  burnedHectares: 62213,
  // Berita: isi dari backend/sumber berita. Bentuk: { title, source, date (ISO), url }
  news: [],
  fires: [
    { id: 'kotawaringin-barat', name: 'Kabupaten Kotawaringin Barat', province: 'Kalimantan Tengah', affected: ['Kalimantan Tengah'], lat: -2.80, lng: 111.75,
      cities: [{ name: 'Kumai', aqi: 923, lat: -2.73, lng: 111.73 }] },
    { id: 'kapuas', name: 'Kabupaten Kapuas', province: 'Kalimantan Tengah', affected: ['Kalimantan Tengah'], lat: -2.85, lng: 114.30,
      cities: [{ name: 'Matangai', aqi: 278, lat: -2.50, lng: 114.10 }] },
    { id: 'luwu-timur', name: 'Kabupaten Luwu Timur', province: 'Sulawesi Selatan', affected: ['Sulawesi Selatan', 'Sulawesi Tengah'], lat: -2.55, lng: 121.15,
      cities: [{ name: 'Malili', aqi: 72, lat: -2.58, lng: 121.10 }, { name: 'Kolonodale', aqi: 70, lat: -2.00, lng: 121.33 }, { name: 'Bungku', aqi: 72, lat: -2.55, lng: 121.93 }] },
    { id: 'kutai-kartanegara', name: 'Kabupaten Kutai Kartanegara', province: 'Kalimantan Timur', affected: ['Kalimantan Timur'], lat: -0.45, lng: 116.85,
      cities: [{ name: 'Sebulu', aqi: 82, lat: -0.42, lng: 116.95 }] },
    { id: 'maluku-tengah', name: 'Kabupaten Maluku Tengah', province: 'Maluku', affected: ['Maluku'], lat: -3.00, lng: 129.60,
      cities: [{ name: 'Wahai', aqi: 136, lat: -2.80, lng: 129.50 }, { name: 'Werinama', aqi: 135, lat: -3.10, lng: 129.90 }, { name: 'Tehoru', aqi: 129, lat: -3.35, lng: 129.50 }] },
    { id: 'buru-selatan', name: 'Kabupaten Buru Selatan', province: 'Maluku', affected: ['Maluku'], lat: -3.80, lng: 126.60,
      cities: [{ name: 'Ternate', aqi: 110, lat: 0.79, lng: 127.38 }, { name: 'Leksula', aqi: 106, lat: -3.78, lng: 126.45 }, { name: 'Namrole', aqi: 102, lat: -3.85, lng: 126.67 }] },
    { id: 'kotabaru', name: 'Kabupaten Kotabaru', province: 'Kalimantan Selatan', affected: ['Kalimantan Selatan'], lat: -3.20, lng: 116.20,
      cities: [{ name: 'Kotabaru Hilir', aqi: 85, lat: -3.25, lng: 116.22 }] },
    { id: 'tana-toraja', name: 'Kabupaten Tana Toraja', province: 'Sulawesi Selatan', affected: ['Sulawesi Selatan'], lat: -3.05, lng: 119.80,
      cities: [{ name: 'Buakayu', aqi: 84, lat: -3.20, lng: 119.80 }] },
    { id: 'sorong-selatan', name: 'Kabupaten Sorong Selatan', province: 'Papua Barat', affected: ['Papua Barat'], lat: -1.60, lng: 132.00,
      cities: [{ name: 'Teminabuan', aqi: 117, lat: -1.45, lng: 132.02 }] }
  ]
};

const PROVINCES = ['Aceh', 'Bali', 'Bangka Belitung', 'Banten', 'Bengkulu', 'Gorontalo', 'Jakarta', 'Jambi', 'Jawa Barat', 'Jawa Tengah', 'Jawa Timur',
  'Kalimantan Barat', 'Kalimantan Selatan', 'Kalimantan Tengah', 'Kalimantan Timur', 'Kalimantan Utara', 'Kepulauan Riau', 'Lampung', 'Maluku', 'Maluku Utara',
  'Nusa Tenggara Barat', 'Nusa Tenggara Timur', 'Papua', 'Papua Barat', 'Riau', 'Sulawesi Barat', 'Sulawesi Selatan', 'Sulawesi Tengah', 'Sulawesi Tenggara',
  'Sulawesi Utara', 'Sumatera Barat', 'Sumatera Selatan', 'Sumatera Utara', 'Yogyakarta'];

async function fetchFireData() {
  if (CONFIG.USE_SAMPLE) return SAMPLE;
  const res = await fetch(CONFIG.API_URL);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}
