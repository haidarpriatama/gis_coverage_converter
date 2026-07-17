# CSV Coverage Grid Converter

CSV Coverage Grid Converter adalah demo aplikasi web tanpa database untuk mengubah setiap baris koordinat CSV menjadi polygon persegi **153 m × 153 m**. Hasil dapat diunduh sebagai KML untuk Google Earth atau GeoPackage (GPKG) untuk QGIS. Upload berada di memori, output dibuat di direktori sementara, disalin ke response, lalu direktori tersebut dihapus sebelum response dikirim.

## Fitur

- Upload CSV hingga 50 MB, dengan delimiter koma atau titik koma.
- Mendukung UTF-8, UTF-8 dengan BOM, dan fallback Windows-1252.
- Inspeksi header, jumlah baris, serta deteksi otomatis kolom standar.
- Pemetaan kolom longitude, latitude, nama grid, dan kategori.
- Validasi numerik dan rentang koordinat; baris tidak valid dilewati dan dihitung.
- Polygon persegi dibuat dalam projected CRS berbasis meter, bukan penambahan derajat kasar.
- KML dengan shared styles, fill opacity 60%, outline, popup HTML, dan `ExtendedData`.
- GPKG EPSG:4326 dengan layer `coverage_grid`, atribut typed, dan `style_color`.
- Tidak memakai database, autentikasi, peta, histori, atau penyimpanan permanen.

## Stack

- Frontend: Next.js 16, TypeScript, App Router, Tailwind CSS 4, React Hook Form, Zod.
- Backend: FastAPI, Pandas, GeoPandas, Shapely, PyProj, Pyogrio, GDAL/OGR, Uvicorn.
- Testing: Pytest dan FastAPI TestClient.

## Struktur

```text
csv-coverage-grid-converter/
├── frontend/                 # Next.js UI dan API client
│   ├── app/
│   ├── components/
│   └── lib/
├── backend/                  # FastAPI dan conversion services
│   └── app/
│       ├── api/
│       ├── schemas/
│       ├── services/
│       ├── tests/
│       └── utils/
├── sample-data/              # CSV siap uji
├── docker-compose.yml
└── README.md
```

## Menjalankan secara lokal

Prasyarat: Node.js 20+ (Node.js 22 direkomendasikan), Python 3.10+, dan library sistem GDAL. Pada Debian/Ubuntu, bila wheel Python tidak cukup, pasang `gdal-bin libgdal-dev libspatialindex-dev`.

Backend:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload
```

Frontend, pada terminal lain:

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

Buka `http://localhost:3000`. Dokumentasi OpenAPI tersedia di `http://localhost:8000/docs`, sedangkan health check berada di `http://localhost:8000/api/health`.

## Menjalankan dengan Docker

```bash
docker compose up --build
```

Compose hanya menjalankan service `frontend` dan `backend`; tidak ada service database. Hentikan dengan `Ctrl+C`, lalu jalankan `docker compose down` bila diperlukan.

## Contoh CSV dan arti kolom

Gunakan file [`sample-data/redcov_banyumanik.csv`](sample-data/redcov_banyumanik.csv), atau CSV seperti berikut:

```csv
geohash7,latitude_geohash7,longitude_geohash7,avg_rsrp,total_subscriber_count,red_cov_category
qqwxbvr,-7.04567,110.434,-105.316,43,RED ENGINEERING
qqwxbvs,-7.04610,110.435,-98.210,28,BAD NON POTENTIAL
```

Kolom output utama:

| Kolom | Isi | Tipe output yang diupayakan |
| --- | --- | --- |
| `geohash7` | ID/nama polygon | text |
| `latitude_geohash7` | latitude pusat EPSG:4326 | float |
| `longitude_geohash7` | longitude pusat EPSG:4326 | float |
| `avg_rsrp` | rata-rata RSRP | float |
| `total_subscriber_count` | jumlah subscriber | integer jika seluruh nilai valid integer |
| `red_cov_category` | kategori coverage | text |
| `style_color` | warna kategori `#RRGGBB` | text |

CSV boleh memiliki kolom tambahan. Pada demo ini hanya atribut utama di atas yang dibawa ke output. Tidak ada join ke sumber data lain.

## Cara melakukan konversi

1. Buka frontend dan drop/pilih file `.csv`.
2. Tunggu inspeksi header dan jumlah baris.
3. Periksa dropdown longitude, latitude, nama grid, dan kategori. Nama kolom standar otomatis dipilih bila ditemukan.
4. Pilih KML atau GeoPackage.
5. Klik **Convert and download**.
6. Browser langsung mengunduh `<nama_input>_grid.kml` atau `<nama_input>_grid.gpkg`. Ringkasan menampilkan total, valid, dan skipped rows.

Secara internal backend mengambil median koordinat valid untuk menentukan zona UTM dan hemisfer. Titik EPSG:4326 ditransformasikan ke UTM, dibuat kotak Shapely dengan setengah sisi 76,5 meter, kemudian ditransformasikan kembali ke EPSG:4326. Satu CRS dipakai per file agar seluruh feature konsisten.

## Membuka output

### Google Earth

Di Google Earth Pro gunakan **File → Open**, pilih file `.kml`, lalu klik polygon. Popup menampilkan geohash, average RSRP, subscriber count, kategori, serta koordinat pusat. Warna awal:

- `RED ENGINEERING`: merah.
- `RED OPTIM`: oranye.
- `BAD NON POTENTIAL`: abu-abu.
- kategori lain: kuning.

### QGIS

Drag file `.gpkg` ke QGIS atau gunakan **Layer → Add Layer → Add Vector Layer**, kemudian pilih layer `coverage_grid`. CRS layer adalah EPSG:4326. Gunakan field `style_color` untuk categorized/data-defined symbology bila dibutuhkan.

## Endpoint API

- `GET /api/health` — status service.
- `POST /api/csv/inspect` — multipart field `file`; mengembalikan header, jumlah row, dan suggested columns.
- `POST /api/convert` — multipart fields `file`, `longitude_column`, `latitude_column`, `name_column`, `category_column`, `output_format`, `grid_width_m`, `grid_height_m`, dan `fill_opacity`.

Response konversi menyertakan `Content-Disposition`, `X-Total-Rows`, `X-Valid-Rows`, dan `X-Invalid-Rows`. CORS mengekspos header tersebut ke frontend.

## Testing

```bash
cd backend
source .venv/bin/activate
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 pytest -q
```

`PYTEST_DISABLE_PLUGIN_AUTOLOAD=1` menjaga test tetap terisolasi dari plugin Pytest global (misalnya plugin ROS yang mungkin ada pada workstation). Test mencakup parsing BOM/delimiter, validasi file dan koordinat, pembuangan baris invalid, ukuran serta pusat polygon, preservasi atribut, jumlah feature, XML KML, layer GPKG, metadata response, dan penolakan file non-CSV.

Untuk memeriksa frontend:

```bash
cd frontend
npm run lint
npm run build
```

## Known limitations

- Satu projected CRS UTM dipilih dari median data untuk satu file. CSV yang melintasi banyak zona UTM atau mencakup area sangat luas tidak ideal untuk workflow grid lokal ini.
- Koordinat di wilayah kutub berada di luar area penggunaan praktis UTM walaupun validasi numerik menerima rentang EPSG:4326. Data coverage seluler yang menjadi target demo biasanya bersifat lokal dan jauh dari kutub.
- KML ditulis langsung menggunakan XML standar OGC. Ini disengaja agar export KML tetap bekerja saat build GDAL tidak menyediakan driver `KML`/`LIBKML`.
- GPKG memerlukan driver `GPKG` pada GDAL yang digunakan Pyogrio. Image Docker memasang GDAL dan dependency terkait.
- Style QGIS belum disimpan sebagai layer style; `style_color` disediakan untuk styling lanjutan.
- Semua feature dari satu CSV dimuat ke memori selama request. Batas 50 MB sesuai scope demo, bukan pipeline untuk file geospasial skala sangat besar.

## Troubleshooting GDAL, KML, dan GPKG

Lihat driver Pyogrio yang tersedia:

```bash
python -c "import pyogrio; print(pyogrio.list_drivers())"
ogrinfo --formats | grep -E 'GPKG|KML|LIBKML'
```

Jika `GPKG` tidak tersedia, pastikan GDAL dan wheel Pyogrio kompatibel, lalu buat ulang virtual environment atau gunakan image Docker. Pada Linux, error `libgdal.so` umumnya diselesaikan dengan memasang paket runtime/development GDAL yang sesuai distribusi.

Ketersediaan `KML`/`LIBKML` tidak memblokir aplikasi ini karena KML memakai writer XML internal. Jika KML tidak terbuka, validasi XML dengan:

```bash
python -c "import xml.etree.ElementTree as ET; ET.parse('output_grid.kml'); print('KML XML valid')"
```

Pastikan juga koordinat CSV menggunakan urutan longitude/latitude yang benar dan CRS EPSG:4326.
# gis_coverage_converter
