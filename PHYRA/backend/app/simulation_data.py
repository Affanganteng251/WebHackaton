"""
PHYRA - Modul Data Simulasi Risiko Karhutla Kalimantan (Simulation Mode)

Modul ini menyediakan data sintetis terkontrol untuk pengujian fitur peta risiko,
kontrol horizon waktu (7, 14, 30 hari), indikator cuaca, dan faktor penjelasan demonstrasi.

PERINGATAN PENTING:
- Seluruh data dalam modul ini adalah DATA SIMULASI / SINTETIS untuk pengujian alur UI/UX.
- Data ini TIDAK BOLEH disimpan ke tabel PostgreSQL produksi (`hotspots`).
- Data ini TIDAK BOLEH memicu notifikasi publik atau langganan (`subscriptions`).
- Faktor penjelasan adalah CONTOH DEMONSTRASI, bukan klaim output model SHAP/ML terlatih.
"""

from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional, Any

# Timestamp acuan simulasi
SIM_NOW = datetime.now(timezone.utc)

# 1. Definisi Kecamatan Terpilih untuk Simulasi Risiko (Mewakili 5 Provinsi Kalimantan)
# Menggunakan GID_3 valid dari tabel districts PostGIS
SIMULATION_DISTRICTS: Dict[str, Dict[str, Any]] = {
    # Kalimantan Tengah - Daerah Rawan Gambut & Asap Pekat (Palangka Raya)
    "IDN.14.11.3_1": {
        "gid_3": "IDN.14.11.3_1",
        "name": "Pahandut",
        "regency": "Palangka Raya",
        "province": "Kalimantan Tengah",
        "soil_type": "Gambut Tebal (Peatland)",
        "weather": {
            "temperature_c": 34.8,
            "humidity_pct": 42.0,
            "rainfall_24h_mm": 0.0,
            "consecutive_dry_days": 19,
            "wind_speed_kmh": 14.5,
            "fwi": 38.5,
            "fwi_category": "Ekstrem",
            "kbdi": 645,
            "peat_water_table_cm": -48.0,  # Penurunan muka air tanah gambut kritis
        },
        "risk": {
            "7d": {
                "category": "high",
                "max_probability": 0.78,
                "high_risk_cells": 14,
                "confidence": "simulated",
                "explanation_factors": [
                    {
                        "factor": "Defisit Curah Hujan 14 Hari",
                        "impact": "+32%",
                        "description": "Akumulasi curah hujan < 10 mm dalam 2 pekan terakhir di kubah gambut."
                    },
                    {
                        "factor": "Penurunan Muka Air Gambut",
                        "impact": "+28%",
                        "description": "Muka air tanah gambut turun hingga -48 cm, melampaui batas aman PP 57/2016 (-40 cm)."
                    },
                    {
                        "factor": "Anomali Suhu Permukaan",
                        "impact": "+18%",
                        "description": "Suhu maksimum siang hari 34.8°C (+2.4°C di atas rata-rata klimatologis)."
                    },
                    {
                        "factor": "Hari Tanpa Hujan Beruntun",
                        "impact": "+14%",
                        "description": "19 hari berturut-turut tanpa presipitasi terukur."
                    }
                ]
            },
            "14d": {
                "category": "extreme",
                "max_probability": 0.91,
                "high_risk_cells": 22,
                "confidence": "simulated",
                "explanation_factors": [
                    {
                        "factor": "Kekeringan Kumulatif Gambut",
                        "impact": "+38%",
                        "description": "Proyeksi kadar air gambut turun di bawah 100% gravimetri, sangat mudah terbakar."
                    },
                    {
                        "factor": "Prakiraan Defisit Hujan Lanjutan",
                        "impact": "+30%",
                        "description": "Indeks anomali Madden-Julian Oscillation (MJO) fase kering berlanjut."
                    },
                    {
                        "factor": "Kedekatan Jaringan Kanal Terdegradasi",
                        "impact": "+18%",
                        "description": "Kerapatan drainase kanal mempercepat pengeringan gambut sekitarnya."
                    }
                ]
            },
            "30d": {
                "category": "extreme",
                "max_probability": 0.86,
                "high_risk_cells": 19,
                "confidence": "simulated",
                "explanation_factors": [
                    {
                        "factor": "Puncak Musim Kemarau Regional",
                        "impact": "+42%",
                        "description": "Pola klimatologi historis menunjukkan puncak hotspot Kalteng pada akhir kemarau."
                    },
                    {
                        "factor": "Ketahanan Api Bawah Permukaan (Smoldering)",
                        "impact": "+31%",
                        "description": "Potensi kebakaran bawah permukaan gambut sulit padam secara alami."
                    }
                ]
            }
        }
    },

    # Kalimantan Tengah - Kubah Gambut Terdegradasi (Kapuas)
    "IDN.14.5.12_1": {
        "gid_3": "IDN.14.5.12_1",
        "name": "Mantangai",
        "regency": "Kapuas",
        "province": "Kalimantan Tengah",
        "soil_type": "Kubah Gambut Terdegradasi (Ex-PLG)",
        "weather": {
            "temperature_c": 35.2,
            "humidity_pct": 39.0,
            "rainfall_24h_mm": 0.0,
            "consecutive_dry_days": 21,
            "wind_speed_kmh": 16.0,
            "fwi": 42.1,
            "fwi_category": "Ekstrem",
            "kbdi": 680,
            "peat_water_table_cm": -54.0,
        },
        "risk": {
            "7d": {
                "category": "high",
                "max_probability": 0.82,
                "high_risk_cells": 18,
                "confidence": "simulated",
                "explanation_factors": [
                    {
                        "factor": "Kondisi Kubah Gambut Sangat Kering",
                        "impact": "+36%",
                        "description": "Tinggi muka air gambut mencapai -54 cm di zona bekas proyek lahan gambut."
                    },
                    {
                        "factor": "Hari Tanpa Hujan Panjang",
                        "impact": "+27%",
                        "description": "21 hari berturut-turut tanpa hujan efektif."
                    },
                    {
                        "factor": "Kelembaban Relatif Rendah",
                        "impact": "+20%",
                        "description": "Kelembaban udara siang hari menyentuh 39%."
                    }
                ]
            },
            "14d": {
                "category": "extreme",
                "max_probability": 0.94,
                "high_risk_cells": 26,
                "confidence": "simulated",
                "explanation_factors": [
                    {
                        "factor": "Proyeksi FWI Ekstrem",
                        "impact": "+40%",
                        "description": "Fire Weather Index diproyeksikan bertahan di level ekstrem (>40)."
                    },
                    {
                        "factor": "Kekeringan Bahan Bakar Halus (FFMC)",
                        "impact": "+32%",
                        "description": "Lapisan serasah atas mengering sempurna sebagai pemicu api cepat."
                    }
                ]
            },
            "30d": {
                "category": "extreme",
                "max_probability": 0.89,
                "high_risk_cells": 23,
                "confidence": "simulated",
                "explanation_factors": [
                    {
                        "factor": "Kondisi Kemarau Terakumulasi",
                        "impact": "+45%",
                        "description": "Defisit neraca air tanah gambut mencapai tingkat kritis."
                    }
                ]
            }
        }
    },

    # Kalimantan Barat - Daerah Rawan Gambut Pesisir (Ketapang)
    "IDN.12.4.9_1": {
        "gid_3": "IDN.12.4.9_1",
        "name": "Matan Hilir Selatan",
        "regency": "Ketapang",
        "province": "Kalimantan Barat",
        "soil_type": "Gambut Pesisir & Mineral",
        "weather": {
            "temperature_c": 33.5,
            "humidity_pct": 50.0,
            "rainfall_24h_mm": 1.2,
            "consecutive_dry_days": 12,
            "wind_speed_kmh": 12.0,
            "fwi": 28.4,
            "fwi_category": "Tinggi",
            "kbdi": 520,
            "peat_water_table_cm": -35.0,
        },
        "risk": {
            "7d": {
                "category": "medium",
                "max_probability": 0.58,
                "high_risk_cells": 8,
                "confidence": "simulated",
                "explanation_factors": [
                    {
                        "factor": "Hari Tanpa Hujan Sedang",
                        "impact": "+28%",
                        "description": "12 hari tanpa hujan dengan curah hujan ringan terisolir."
                    },
                    {
                        "factor": "Kadar Air Tanah Gambut Menurun",
                        "impact": "+25%",
                        "description": "Tinggi muka air tanah mendekati batas waspada (-35 cm)."
                    }
                ]
            },
            "14d": {
                "category": "high",
                "max_probability": 0.72,
                "high_risk_cells": 15,
                "confidence": "simulated",
                "explanation_factors": [
                    {
                        "factor": "Peningkatan Indeks Kekeringan",
                        "impact": "+35%",
                        "description": "Ketiadaan hujan jangka menengah diproyeksikan menaikkan kelas risiko."
                    }
                ]
            },
            "30d": {
                "category": "high",
                "max_probability": 0.76,
                "high_risk_cells": 16,
                "confidence": "simulated",
                "explanation_factors": [
                    {
                        "factor": "Kerentanan Kawasan Konservasi & Gambut",
                        "impact": "+38%",
                        "description": "Riwayat karhutla berulang pada lanskap Ketapang selatan."
                    }
                ]
            }
        }
    },

    # Kalimantan Timur - Wilayah Uji & Benchmark (Balikpapan Selatan memuat TEST-001)
    "IDN.34.1.2_1": {
        "gid_3": "IDN.34.1.2_1",
        "name": "Balikpapan Selatan",
        "regency": "Balikpapan",
        "province": "Kalimantan Timur",
        "soil_type": "Tanah Mineral / Perkotaan",
        "weather": {
            "temperature_c": 31.8,
            "humidity_pct": 65.0,
            "rainfall_24h_mm": 4.5,
            "consecutive_dry_days": 5,
            "wind_speed_kmh": 11.0,
            "fwi": 16.2,
            "fwi_category": "Sedang",
            "kbdi": 340,
            "peat_water_table_cm": None,  # Bukan lahan gambut
        },
        "risk": {
            "7d": {
                "category": "medium",
                "max_probability": 0.45,
                "high_risk_cells": 3,
                "confidence": "simulated",
                "explanation_factors": [
                    {
                        "factor": "Suhu Siang Hangat & Semak Belukar",
                        "impact": "+22%",
                        "description": "Suhu permukaan hangat dengan potensi bahan bakar kering di area terbuka."
                    },
                    {
                        "factor": "Keberadaan Titik Data Uji (TEST-001)",
                        "impact": "+15%",
                        "description": "Titik benchmark pengujian sistem aktif di wilayah ini."
                    }
                ]
            },
            "14d": {
                "category": "medium",
                "max_probability": 0.40,
                "high_risk_cells": 2,
                "confidence": "simulated",
                "explanation_factors": [
                    {
                        "factor": "Kondisi Cuaca Pesisir Lembab",
                        "impact": "-18%",
                        "description": "Angin laut dan kelembaban udara pesisir meredam risiko karhutla luas."
                    }
                ]
            },
            "30d": {
                "category": "low",
                "max_probability": 0.28,
                "high_risk_cells": 1,
                "confidence": "simulated",
                "explanation_factors": [
                    {
                        "factor": "Prakiraan Hujan Musim Peralihan",
                        "impact": "-30%",
                        "description": "Model iklim memproyeksikan peningkatan frekuensi hujan pesisir timur."
                    }
                ]
            }
        }
    },

    # Kalimantan Timur - Wilayah Risiko Rendah (Hutan Lindung Sungai Wain & Mangrove)
    "IDN.34.1.1_1": {
        "gid_3": "IDN.34.1.1_1",
        "name": "Balikpapan Barat",
        "regency": "Balikpapan",
        "province": "Kalimantan Timur",
        "soil_type": "Mineral & Mangrove Pesisir",
        "weather": {
            "temperature_c": 30.2,
            "humidity_pct": 74.0,
            "rainfall_24h_mm": 9.0,
            "consecutive_dry_days": 2,
            "wind_speed_kmh": 9.0,
            "fwi": 8.1,
            "fwi_category": "Rendah",
            "kbdi": 210,
            "peat_water_table_cm": None,
        },
        "risk": {
            "7d": {
                "category": "low",
                "max_probability": 0.15,
                "high_risk_cells": 0,
                "confidence": "simulated",
                "explanation_factors": [
                    {
                        "factor": "Kelembaban Tinggi & Ekosistem Basah",
                        "impact": "-40%",
                        "description": "Tutupan mangrove dan hutan lembab meminimalkan potensi penyebaran api."
                    }
                ]
            },
            "14d": {
                "category": "low",
                "max_probability": 0.12,
                "high_risk_cells": 0,
                "confidence": "simulated",
                "explanation_factors": [
                    {
                        "factor": "Cadangan Air Permukaan Cukup",
                        "impact": "-45%",
                        "description": "Kondisi hidrologis stabil dan kelembaban tanah terjaga."
                    }
                ]
            },
            "30d": {
                "category": "low",
                "max_probability": 0.10,
                "high_risk_cells": 0,
                "confidence": "simulated",
                "explanation_factors": [
                    {
                        "factor": "Kondisi Basah Berkepanjangan",
                        "impact": "-50%",
                        "description": "Risiko kebakaran hutan sangat minimal."
                    }
                ]
            }
        }
    },

    # Kalimantan Selatan - Wilayah Sedang/Tinggi (Area Bandara Syamsudin Noor & Gambut Landasan Ulin)
    "IDN.13.2.1_1": {
        "gid_3": "IDN.13.2.1_1",
        "name": "Banjar Baru Selatan",
        "regency": "Banjar Baru",
        "province": "Kalimantan Selatan",
        "soil_type": "Mineral & Semak Belukar",
        "weather": {
            "temperature_c": 33.8,
            "humidity_pct": 48.0,
            "rainfall_24h_mm": 0.0,
            "consecutive_dry_days": 14,
            "wind_speed_kmh": 15.0,
            "fwi": 31.2,
            "fwi_category": "Tinggi",
            "kbdi": 560,
            "peat_water_table_cm": None,
        },
        "risk": {
            "7d": {
                "category": "medium",
                "max_probability": 0.52,
                "high_risk_cells": 6,
                "confidence": "simulated",
                "explanation_factors": [
                    {
                        "factor": "14 Hari Tanpa Hujan",
                        "impact": "+30%",
                        "description": "Semak belukar kering berpotensi memicu api cepat."
                    }
                ]
            },
            "14d": {
                "category": "high",
                "max_probability": 0.68,
                "high_risk_cells": 12,
                "confidence": "simulated",
                "explanation_factors": [
                    {
                        "factor": "Peningkatan Kecepatan Angin & Suhu",
                        "impact": "+34%",
                        "description": "Angin kencang meningkatkan kecepatan penjalaran api permukaan."
                    }
                ]
            },
            "30d": {
                "category": "medium",
                "max_probability": 0.50,
                "high_risk_cells": 7,
                "confidence": "simulated",
                "explanation_factors": [
                    {
                        "factor": "Fluktuasi Hujan Musim Transisi",
                        "impact": "-15%",
                        "description": "Potensi hujan sporadis di akhir bulan simulasi."
                    }
                ]
            }
        }
    },

    # Kalimantan Utara - Wilayah Basah (Curah Hujan Tinggi, Bulungan)
    "IDN.35.4.10": {
        "gid_3": "IDN.35.4.10",
        "name": "Tanjung Selor",
        "regency": "Bulungan",
        "province": "Kalimantan Utara",
        "soil_type": "Mineral Subur / Daerah Aliran Sungai",
        "weather": {
            "temperature_c": 28.5,
            "humidity_pct": 82.0,
            "rainfall_24h_mm": 18.5,
            "consecutive_dry_days": 1,
            "wind_speed_kmh": 8.0,
            "fwi": 6.2,
            "fwi_category": "Rendah",
            "kbdi": 120,
            "peat_water_table_cm": None,
        },
        "risk": {
            "7d": {
                "category": "low",
                "max_probability": 0.10,
                "high_risk_cells": 0,
                "confidence": "simulated",
                "explanation_factors": [
                    {
                        "factor": "Curah Hujan Harian Tinggi (18.5 mm)",
                        "impact": "-60%",
                        "description": "Kondisi serasah sangat basah, tidak memungkinkan penyalaan api."
                    }
                ]
            },
            "14d": {
                "category": "low",
                "max_probability": 0.08,
                "high_risk_cells": 0,
                "confidence": "simulated",
                "explanation_factors": [
                    {
                        "factor": "Kelembaban Udara Sangat Tinggi",
                        "impact": "-55%",
                        "description": "Rata-rata kelembaban >80% sepanjang dasarian."
                    }
                ]
            },
            "30d": {
                "category": "low",
                "max_probability": 0.05,
                "high_risk_cells": 0,
                "confidence": "simulated",
                "explanation_factors": [
                    {
                        "factor": "Karakter Iklim Tropika Basah Kaltara",
                        "impact": "-65%",
                        "description": "Frekuensi hujan reguler sepanjang tahun."
                    }
                ]
            }
        }
    }
}

# 2. Titik Api Simulasi (Simulated Hotspots)
# Koordinat berada di dalam poligon kecamatan masing-masing
SIMULATION_HOTSPOTS: List[Dict[str, Any]] = [
    # Hotspot simulasi di Pahandut (Palangka Raya, Kalteng)
    {
        "id": "HS-SIM-001",
        "latitude": -2.2133,
        "longitude": 113.9527,
        "detected_at": (SIM_NOW - timedelta(hours=2)).isoformat(),
        "confidence": 0.88,
        "frp": 16.5,
        "satellite": "VIIRS-SIM",
        "district_gid_3": "IDN.14.11.3_1",
        "district_name": "Pahandut",
        "regency": "Palangka Raya",
        "province": "Kalimantan Tengah",
        "is_peatland": True,
        "data_source": "simulation",
        "is_simulation": True,
        "warning": "SIMULASI — BUKAN DATA AKTUAL",
    },
    {
        "id": "HS-SIM-002",
        "latitude": -2.2250,
        "longitude": 113.9400,
        "detected_at": (SIM_NOW - timedelta(hours=4)).isoformat(),
        "confidence": 0.92,
        "frp": 24.0,
        "satellite": "VIIRS-SIM",
        "district_gid_3": "IDN.14.11.3_1",
        "district_name": "Pahandut",
        "regency": "Palangka Raya",
        "province": "Kalimantan Tengah",
        "is_peatland": True,
        "data_source": "simulation",
        "is_simulation": True,
        "warning": "SIMULASI — BUKAN DATA AKTUAL",
    },
    {
        "id": "HS-SIM-003",
        "latitude": -2.2050,
        "longitude": 113.9600,
        "detected_at": (SIM_NOW - timedelta(hours=10)).isoformat(),
        "confidence": 0.76,
        "frp": 9.8,
        "satellite": "MODIS-SIM",
        "district_gid_3": "IDN.14.11.3_1",
        "district_name": "Pahandut",
        "regency": "Palangka Raya",
        "province": "Kalimantan Tengah",
        "is_peatland": True,
        "data_source": "simulation",
        "is_simulation": True,
        "warning": "SIMULASI — BUKAN DATA AKTUAL",
    },
    {
        "id": "HS-SIM-004",
        "latitude": -2.2300,
        "longitude": 113.9700,
        "detected_at": (SIM_NOW - timedelta(days=1, hours=3)).isoformat(),
        "confidence": 0.85,
        "frp": 14.2,
        "satellite": "VIIRS-SIM",
        "district_gid_3": "IDN.14.11.3_1",
        "district_name": "Pahandut",
        "regency": "Palangka Raya",
        "province": "Kalimantan Tengah",
        "is_peatland": True,
        "data_source": "simulation",
        "is_simulation": True,
        "warning": "SIMULASI — BUKAN DATA AKTUAL",
    },

    # Hotspot simulasi di Mantangai (Kapuas, Kalteng)
    {
        "id": "HS-SIM-005",
        "latitude": -1.9600,
        "longitude": 114.3030,
        "detected_at": (SIM_NOW - timedelta(hours=1)).isoformat(),
        "confidence": 0.95,
        "frp": 32.5,
        "satellite": "VIIRS-SIM",
        "district_gid_3": "IDN.14.5.12_1",
        "district_name": "Mantangai",
        "regency": "Kapuas",
        "province": "Kalimantan Tengah",
        "is_peatland": True,
        "data_source": "simulation",
        "is_simulation": True,
        "warning": "SIMULASI — BUKAN DATA AKTUAL",
    },
    {
        "id": "HS-SIM-006",
        "latitude": -1.9400,
        "longitude": 114.3200,
        "detected_at": (SIM_NOW - timedelta(hours=6)).isoformat(),
        "confidence": 0.89,
        "frp": 21.0,
        "satellite": "VIIRS-SIM",
        "district_gid_3": "IDN.14.5.12_1",
        "district_name": "Mantangai",
        "regency": "Kapuas",
        "province": "Kalimantan Tengah",
        "is_peatland": True,
        "data_source": "simulation",
        "is_simulation": True,
        "warning": "SIMULASI — BUKAN DATA AKTUAL",
    },
    {
        "id": "HS-SIM-007",
        "latitude": -1.9800,
        "longitude": 114.2800,
        "detected_at": (SIM_NOW - timedelta(hours=18)).isoformat(),
        "confidence": 0.78,
        "frp": 11.5,
        "satellite": "MODIS-SIM",
        "district_gid_3": "IDN.14.5.12_1",
        "district_name": "Mantangai",
        "regency": "Kapuas",
        "province": "Kalimantan Tengah",
        "is_peatland": True,
        "data_source": "simulation",
        "is_simulation": True,
        "warning": "SIMULASI — BUKAN DATA AKTUAL",
    },

    # Hotspot simulasi di Matan Hilir Selatan (Ketapang, Kalbar)
    {
        "id": "HS-SIM-008",
        "latitude": -2.0470,
        "longitude": 110.2400,
        "detected_at": (SIM_NOW - timedelta(hours=5)).isoformat(),
        "confidence": 0.81,
        "frp": 13.0,
        "satellite": "VIIRS-SIM",
        "district_gid_3": "IDN.12.4.9_1",
        "district_name": "Matan Hilir Selatan",
        "regency": "Ketapang",
        "province": "Kalimantan Barat",
        "is_peatland": True,
        "data_source": "simulation",
        "is_simulation": True,
        "warning": "SIMULASI — BUKAN DATA AKTUAL",
    },
    {
        "id": "HS-SIM-009",
        "latitude": -2.0600,
        "longitude": 110.2500,
        "detected_at": (SIM_NOW - timedelta(days=2)).isoformat(),
        "confidence": 0.70,
        "frp": 8.5,
        "satellite": "MODIS-SIM",
        "district_gid_3": "IDN.12.4.9_1",
        "district_name": "Matan Hilir Selatan",
        "regency": "Ketapang",
        "province": "Kalimantan Barat",
        "is_peatland": True,
        "data_source": "simulation",
        "is_simulation": True,
        "warning": "SIMULASI — BUKAN DATA AKTUAL",
    },

    # Hotspot simulasi di Banjar Baru Selatan (Kalsel)
    {
        "id": "HS-SIM-010",
        "latitude": -3.4550,
        "longitude": 114.8540,
        "detected_at": (SIM_NOW - timedelta(hours=7)).isoformat(),
        "confidence": 0.84,
        "frp": 15.0,
        "satellite": "VIIRS-SIM",
        "district_gid_3": "IDN.13.2.1_1",
        "district_name": "Banjar Baru Selatan",
        "regency": "Banjar Baru",
        "province": "Kalimantan Selatan",
        "is_peatland": False,
        "data_source": "simulation",
        "is_simulation": True,
        "warning": "SIMULASI — BUKAN DATA AKTUAL",
    },

    # Hotspot simulasi di Balikpapan Selatan (Kaltim - selain data uji TEST-001)
    {
        "id": "HS-SIM-011",
        "latitude": -1.2520,
        "longitude": 116.8770,
        "detected_at": (SIM_NOW - timedelta(hours=14)).isoformat(),
        "confidence": 0.72,
        "frp": 7.8,
        "satellite": "VIIRS-SIM",
        "district_gid_3": "IDN.34.1.2_1",
        "district_name": "Balikpapan Selatan",
        "regency": "Balikpapan",
        "province": "Kalimantan Timur",
        "is_peatland": False,
        "data_source": "simulation",
        "is_simulation": True,
        "warning": "SIMULASI — BUKAN DATA AKTUAL",
    }
]

# 3. Peringatan Deforestasi Simulasi (Simulated Deforestation Alerts)
SIMULATION_DEFORESTATION: List[Dict[str, Any]] = [
    {
        "id": "DEF-SIM-001",
        "latitude": -2.213,
        "longitude": 113.952,
        "detected_at": (SIM_NOW - timedelta(days=2)).isoformat(),
        "confidence": 0.85,
        "district_gid_3": "IDN.14.11.3_1",
        "source": "GLAD-SIM",
        "data_source": "simulation",
        "is_simulation": True,
        "warning": "SIMULASI — BUKAN DATA AKTUAL",
    },
    {
        "id": "DEF-SIM-002",
        "latitude": -1.960,
        "longitude": 114.303,
        "detected_at": (SIM_NOW - timedelta(days=3)).isoformat(),
        "confidence": 0.90,
        "district_gid_3": "IDN.14.5.12_1",
        "source": "GLAD-SIM",
        "data_source": "simulation",
        "is_simulation": True,
        "warning": "SIMULASI — BUKAN DATA AKTUAL",
    }
]


def get_simulation_status() -> Dict[str, Any]:
    """Mengembalikan status mode simulasi untuk metadata status."""
    return {
        "data_mode": "simulation",
        "is_simulation": True,
        "warning": "MODE SIMULASI — BUKAN DATA AKTUAL. Digunakan untuk pengujian alur UI/UX risiko.",
        "simulated_hotspots_count": len(SIMULATION_HOTSPOTS),
        "simulated_districts_count": len(SIMULATION_DISTRICTS),
        "available_horizons": [7, 14, 30],
        "generated_at": SIM_NOW.isoformat(),
    }


def get_simulation_hotspots(bbox: Optional[str] = None, since: Optional[str] = None) -> List[Dict[str, Any]]:
    """Mengambil hotspot simulasi dengan filter spasial (bbox) dan temporal (since)."""
    items = list(SIMULATION_HOTSPOTS)

    # Filter bounding box
    if bbox:
        try:
            min_lon, min_lat, max_lon, max_lat = [float(x.strip()) for x in bbox.split(",")]
            items = [
                h for h in items
                if min_lon <= h["longitude"] <= max_lon and min_lat <= h["latitude"] <= max_lat
            ]
        except Exception:
            pass

    # Filter temporal
    if since:
        try:
            since_dt = datetime.fromisoformat(since.replace("Z", "+00:00"))
            if since_dt.tzinfo is None:
                since_dt = since_dt.replace(tzinfo=timezone.utc)
            filtered = []
            for h in items:
                dt = datetime.fromisoformat(h["detected_at"].replace("Z", "+00:00"))
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=timezone.utc)
                if dt >= since_dt:
                    filtered.append(h)
            items = filtered
        except Exception:
            pass

    return items


def get_simulation_risk(horizon: int = 7) -> Dict[str, Any]:
    """
    Mengembalikan pemetaan risiko untuk seluruh kecamatan simulasi pada horizon tertentu (7, 14, 30 hari).
    Format disesuaikan untuk konsumsi styling peta poligon GeoJSON frontend.
    """
    horizon_key = f"{horizon}d"
    items = []

    for gid_3, d in SIMULATION_DISTRICTS.items():
        risk_h = d["risk"].get(horizon_key, {
            "category": "unknown",
            "max_probability": None,
            "high_risk_cells": 0,
            "explanation_factors": []
        })
        items.append({
            "gid_3": gid_3,
            "name": d["name"],
            "regency": d["regency"],
            "province": d["province"],
            "horizon_days": horizon,
            "category": risk_h.get("category", "unknown"),
            "max_probability": risk_h.get("max_probability"),
            "high_risk_cells": risk_h.get("high_risk_cells", 0),
            "soil_type": d.get("soil_type"),
            "weather_summary": d.get("weather"),
            "explanation_factors": risk_h.get("explanation_factors", []),
            "disclaimer": "Faktor penjelasan ini adalah contoh demonstrasi UI/UX, bukan klaim hasil kalkulasi SHAP model ML.",
        })

    return {
        "data_mode": "simulation",
        "is_simulation": True,
        "warning": "MODE SIMULASI — BUKAN DATA AKTUAL. Nilai risiko dan faktor penjelasan adalah sintetis.",
        "horizon_days": horizon,
        "count": len(items),
        "items": items,
    }


def get_simulation_district_summary(gid_3: str, actual_data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Mengembalikan ringkasan kecamatan dengan komparasi eksplisit:
    - Data Aktual (PostGIS): Poligon batas wilayah, hotspots_7d aktual database, titik uji TEST-001.
    - Data Simulasi: Hotspot simulasi, indikator cuaca, risiko 7/14/30d, dan faktor penjelasan demonstrasi.
    """
    sim_d = SIMULATION_DISTRICTS.get(gid_3)
    if not sim_d and actual_data and actual_data.get("gid_3"):
        sim_d = SIMULATION_DISTRICTS.get(actual_data.get("gid_3"))

    # Hitung hotspot simulasi di kecamatan ini
    sim_hotspots = [h for h in SIMULATION_HOTSPOTS if h.get("district_gid_3") == gid_3]

    actual_hs = actual_data.get("hotspots_7d", 0) if actual_data else 0
    test_hs = actual_data.get("test_hotspots_count", actual_data.get("test_hotspots_7d", 0)) if actual_data else 0

    if sim_d:
        return {
            "data_mode": "simulation",
            "is_simulation": True,
            "warning": "MODE SIMULASI AKTIF: Nilai risiko, cuaca, dan faktor penjelasan adalah data sintetis untuk pengujian antarmuka. Bukan keluaran model ML terlatih.",
            "gid_3": gid_3,
            "name": sim_d["name"],
            "regency": sim_d["regency"],
            "province": sim_d["province"],
            "soil_type": sim_d.get("soil_type"),
            "generated_at": SIM_NOW.isoformat(),
            # Bagian 1: Data Aktual dari PostGIS
            "actual": {
                "boundary_status": "available",
                "hotspots_7d": actual_hs,
                "test_hotspots_count": test_hs,
                "note": "Data batas wilayah kecamatan bersumber dari tabel PostGIS districts. Hotspot aktual dihitung via spatial join.",
            },
            # Bagian 2: Data Simulasi Demonstrasi
            "simulation": {
                "hotspots_simulated_count": len(sim_hotspots),
                "hotspots": sim_hotspots,
                "weather": sim_d.get("weather"),
                "risk": sim_d.get("risk"),
                "explanation_disclaimer": "Faktor penjelasan ini adalah contoh demonstrasi UI/UX, bukan klaim hasil atribusi fitur model SHAP/ML aktual.",
            }
        }

    # Kecamatan yang belum memiliki profil simulasi detail
    return {
        "data_mode": "simulation",
        "is_simulation": True,
        "warning": "Kecamatan ini belum memiliki profil skenario simulasi risiko khusus. Menampilkan status default simulasi.",
        "gid_3": gid_3,
        "name": actual_data.get("name") if actual_data else None,
        "regency": actual_data.get("regency") if actual_data else None,
        "province": actual_data.get("province") if actual_data else None,
        "generated_at": SIM_NOW.isoformat(),
        "actual": {
            "boundary_status": "available" if actual_data else "unknown",
            "hotspots_7d": actual_hs,
            "test_hotspots_count": test_hs,
        },
        "simulation": {
            "hotspots_simulated_count": len(sim_hotspots),
            "hotspots": sim_hotspots,
            "weather": None,
            "risk": {
                "7d": {"category": "unknown", "max_probability": None, "high_risk_cells": 0, "explanation_factors": []},
                "14d": {"category": "unknown", "max_probability": None, "high_risk_cells": 0, "explanation_factors": []},
                "30d": {"category": "unknown", "max_probability": None, "high_risk_cells": 0, "explanation_factors": []},
            },
            "explanation_disclaimer": "Data simulasi tidak tersedia untuk kecamatan ini.",
        }
    }


def get_simulation_deforestation_alerts(bbox: Optional[str] = None, since: Optional[str] = None) -> List[Dict[str, Any]]:
    """Mengambil peringatan deforestasi simulasi dengan filter spasial dan temporal."""
    items = list(SIMULATION_DEFORESTATION)
    if bbox:
        try:
            min_lon, min_lat, max_lon, max_lat = [float(x.strip()) for x in bbox.split(",")]
            items = [
                d for d in items
                if min_lon <= d["longitude"] <= max_lon and min_lat <= d["latitude"] <= max_lat
            ]
        except Exception:
            pass
    if since:
        try:
            since_dt = datetime.fromisoformat(since.replace("Z", "+00:00"))
            if since_dt.tzinfo is None:
                since_dt = since_dt.replace(tzinfo=timezone.utc)
            filtered = []
            for d in items:
                dt = datetime.fromisoformat(d["detected_at"].replace("Z", "+00:00"))
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=timezone.utc)
                if dt >= since_dt:
                    filtered.append(d)
            items = filtered
        except Exception:
            pass
    return items
