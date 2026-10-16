
from app.database import get_hotspots

try:
    data = get_hotspots()
    print("Query hotspots berhasil!")
    print("Jumlah data:", len(data))
    print(data)
except Exception as error:
    print("Query hotspots gagal!")
    print(type(error).__name__)
    print(error)
