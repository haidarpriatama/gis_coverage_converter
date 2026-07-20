# CSV Coverage Grid Converter

CSV Coverage Grid Converter adalah demo aplikasi web tanpa database untuk menempatkan setiap koordinat CSV ke polygon persegi **153 m × 153 m** pada lattice UTM yang sejajar. Hasil dapat diunduh sebagai KML untuk Google Earth atau GeoPackage (GPKG) untuk QGIS. Upload dan output dibuat di direktori sementara, dikirim sebagai download, lalu dibersihkan setelah response selesai.

## Fitur

- Upload CSV hingga 1 GB secara default, dengan delimiter koma atau titik koma.
- File CSV dapat dipilih dari perangkat atau Google Drive melalui Google Picker.
- Progress upload ditampilkan di frontend; saat backend memproses file, UI menampilkan tahap proses yang sedang berjalan.
- Mendukung UTF-8, UTF-8 dengan BOM, dan fallback Windows-1252.
- Inspeksi header, jumlah baris, serta deteksi otomatis kolom standar.
- Pemetaan kolom longitude, latitude, nama grid, dan kategori.
- Validasi numerik dan rentang koordinat; baris tidak valid dilewati dan dihitung.
- Polygon persegi dibuat dalam projected CRS berbasis meter dan di-snap ke lattice UTM, bukan penambahan derajat kasar.
- Sel grid sejajar dan tidak saling menimpa; jika beberapa baris masuk ke sel yang sama, baris pertama dipertahankan.
- KML dengan shared styles, fill opacity 60%, outline, titik koordinat sumber, popup HTML, dan `ExtendedData`.
- GPKG EPSG:4326 dengan layer polygon `coverage_grid`, layer titik merah `coverage_points`, atribut typed, `style_color`, dan embedded default QGIS style.
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
├── docker-compose.yml
└── README.md
```

## Menjalankan secara lokal

Prasyarat: Node.js 20+ (Node.js 22 direkomendasikan), Python 3.10+, dan library sistem GDAL. Pada Debian/Ubuntu, bila wheel Python tidak cukup, pasang `gdal-bin libgdal-dev libspatialindex-dev`. Untuk CSV ratusan MB, pastikan RAM dan temporary disk cukup karena Pandas/GeoPandas tetap memuat data valid untuk proses geometri.

Install pertama kali tetap perlu dilakukan satu kali untuk dependency backend dan frontend.

Backend:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
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

### Mengaktifkan Google Drive

Integrasi Drive memakai Google Identity Services, Google Picker API, dan scope `drive.file`. Scope ini membatasi akses aplikasi ke file yang dipilih pengguna melalui Picker. Di Google Cloud Console:

1. Buat atau pilih Google Cloud project.
2. Aktifkan **Google Picker API** dan **Google Drive API**.
3. Konfigurasikan OAuth consent screen.
4. Buat OAuth Client ID bertipe **Web application**, lalu tambahkan `http://localhost:3000` ke **Authorized JavaScript origins**.
5. Buat API key dan batasi penggunaannya ke Google Picker API/Drive API serta origin frontend.
6. Salin project number sebagai Google App ID.

Isi `frontend/.env.local`:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
NEXT_PUBLIC_GOOGLE_CLIENT_ID=xxxxxxxx.apps.googleusercontent.com
NEXT_PUBLIC_GOOGLE_API_KEY=xxxxxxxx
NEXT_PUBLIC_GOOGLE_APP_ID=123456789012
```

Nilai tersebut memang digunakan oleh aplikasi browser, jadi API key harus dibatasi berdasarkan API dan HTTP referrer di Google Cloud Console. Setelah mengubah env, restart frontend.

Setelah dependency terpasang, frontend dan backend bisa dijalankan bersama dari root project:

```bash
cd /home/haidar/website/csv-coverage-grid-converter
npm run dev
```

Jika port default sedang dipakai, ganti port saat menjalankan:

```bash
BACKEND_PORT=8001 FRONTEND_PORT=3001 npm run dev
```

Buka `http://localhost:3000` untuk port default, atau `http://localhost:3001` bila memakai contoh port custom di atas. Dokumentasi OpenAPI tersedia di `http://localhost:8000/docs`, sedangkan health check berada di `http://localhost:8000/api/health` atau port backend custom yang kamu pilih.

## Menjalankan dengan Docker

```bash
docker compose up --build
```

Compose hanya menjalankan service `frontend` dan `backend`; tidak ada service database. Hentikan dengan `Ctrl+C`, lalu jalankan `docker compose down` bila diperlukan.

## Deployment production

Frontend disiapkan untuk Vercel dengan root directory `frontend`. Backend geospasial tetap dijalankan sebagai container terpisah karena Vercel Functions membatasi payload request/response biasa hingga 4,5 MB, sedangkan aplikasi menerima CSV sampai 1 GB. Browser mengunggah langsung ke URL backend melalui `NEXT_PUBLIC_API_BASE_URL`.

Instruksi environment, deployment Docker, konfigurasi Google Cloud, CORS, security checklist, serta pengujian URL production tersedia di [`DEPLOYMENT.md`](DEPLOYMENT.md).

## Contoh CSV dan arti kolom

Gunakan CSV dengan struktur seperti berikut:

```csv
geohash7,latitude_geohash7,longitude_geohash7,avg_rsrp,total_subscriber_count,red_cov_category
qqwxbvr,-7.04567,110.434,-105.316,43,RED ENGINEERING
qqwxbvs,-7.04610,110.435,-98.210,28,BAD NON POTENTIAL
```

Kolom output utama:

| Kolom | Isi | Tipe output yang diupayakan |
| --- | --- | --- |
| `geohash7` | ID/nama polygon | text |
| `latitude_geohash7` | latitude titik sumber EPSG:4326 | float |
| `longitude_geohash7` | longitude titik sumber EPSG:4326 | float |
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
6. Browser langsung mengunduh `<nama_input>_grid.kml` atau `<nama_input>_grid.gpkg`. Ringkasan menampilkan total, valid, skipped rows, dan jumlah duplikat sel.

Untuk file besar, frontend menampilkan progress upload aktual dari browser. Setelah upload selesai, progress berubah menjadi tahap proses backend seperti membaca CSV, validasi koordinat, pembuatan grid, dan penulisan output. Persentase detail per baris belum tersedia karena endpoint demo masih mengembalikan file download langsung, bukan job asynchronous dengan endpoint status.

Secara internal backend mengambil median koordinat valid untuk menentukan zona UTM dan hemisfer. Setiap titik EPSG:4326 ditransformasikan ke UTM lalu dimasukkan ke sel lattice 153 m menggunakan indeks `floor(x / 153)` dan `floor(y / 153)`. Batas polygon dibentuk dengan Shapely `box()` pada kelipatan tepat 153 meter, kemudian ditransformasikan kembali ke EPSG:4326. Karena semua polygon memakai lattice yang sama, sel hanya dapat berbagi sisi atau sudut dan tidak menimpa area satu sama lain. Titik CSV tetap disimpan pada koordinat aslinya dan tidak harus berada tepat di tengah sel. Jika lebih dari satu baris jatuh pada sel yang sama, hanya baris pertama yang diekspor dan baris berikutnya dihitung sebagai duplikat sel/dilewati.

## Membuka output

### Google Earth

Di Google Earth Pro gunakan **File → Open**, pilih file `.kml`, lalu klik polygon. Popup menampilkan geohash, average RSRP, subscriber count, kategori, serta koordinat sumber. Warna awal:

- `RED ENGINEERING`: merah.
- `RED OPTIM`: kuning.
- `BAD NON POTENTIAL`: hijau.
- `NOT RED COV`: biru.
- kategori lain: abu-abu.

Setiap placemark KML berisi polygon berwarna kategori dan marker titik merah pada longitude-latitude sumber. Marker tidak harus berada tepat di pusat sel hasil snapping.

### QGIS

Drag file `.gpkg` ke QGIS atau gunakan **Layer → Add Layer → Add Vector Layer**, lalu tambahkan kedua layer berikut:

- `coverage_grid`: polygon 153 m × 153 m.
- `coverage_points`: titik longitude-latitude sumber, memakai satu warna merah untuk semua kategori. Marker memakai ukuran pixel agar tidak ikut membesar/mengecil terhadap skala peta saat zoom.

Keduanya menggunakan EPSG:4326 dan memiliki default categorized style yang disimpan pada tabel style GeoPackage. Jika instalasi QGIS tidak otomatis memakai embedded style, buka **Layer Properties → Symbology → Categorized**, pilih field `red_cov_category`, lalu gunakan warna dari `style_color`.

GeoPackage adalah data vektor dan tidak menyertakan basemap. Basemap atau citra satelit ditambahkan secara terpisah dari QGIS melalui XYZ Tiles/WMS sesuai konfigurasi perangkat pengguna.

Untuk melihat atribut feature di QGIS, aktifkan tool **Identify Features** (ikon `i`), lalu klik polygon grid atau titik sumber. Alternatifnya, klik kanan layer dan pilih **Open Attribute Table**. Klik biasa dengan tool pan/select tidak menampilkan popup seperti Google Earth.

## Endpoint API

- `GET /api/health` — status service.
- `POST /api/csv/inspect` — multipart field `file`; mengembalikan header, jumlah row, dan suggested columns.
- `POST /api/convert` — multipart fields `file`, `longitude_column`, `latitude_column`, `name_column`, `category_column`, `output_format`, `grid_width_m`, `grid_height_m`, dan `fill_opacity`.

Response konversi menyertakan `Content-Disposition`, `X-Total-Rows`, `X-Valid-Rows`, `X-Invalid-Rows`, dan `X-Duplicate-Rows`. CORS mengekspos header tersebut ke frontend.

## Testing

```bash
cd backend
source .venv/bin/activate
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 pytest -q
pip-audit -r requirements.txt --progress-spinner off
```

`PYTEST_DISABLE_PLUGIN_AUTOLOAD=1` menjaga test tetap terisolasi dari plugin Pytest global (misalnya plugin ROS yang mungkin ada pada workstation). Test mencakup parsing BOM/delimiter, validasi file dan koordinat, pembuangan baris invalid, dimensi dan alignment polygon, titik sumber berada di dalam sel, pencegahan overlap/duplikat sel, preservasi atribut, jumlah feature, XML KML, layer GPKG, metadata response, dan penolakan file non-CSV.

Untuk memeriksa frontend:

```bash
cd frontend
npm run lint
npm run build
npm audit --omit=dev
```

## Known limitations

- Satu projected CRS UTM dipilih dari median data untuk satu file. CSV yang melintasi banyak zona UTM atau mencakup area sangat luas tidak ideal untuk workflow grid lokal ini.
- Koordinat di wilayah kutub berada di luar area penggunaan praktis UTM walaupun validasi numerik menerima rentang EPSG:4326. Data coverage seluler yang menjadi target demo biasanya bersifat lokal dan jauh dari kutub.
- KML ditulis langsung menggunakan XML standar OGC. Ini disengaja agar export KML tetap bekerja saat build GDAL tidak menyediakan driver `KML`/`LIBKML`.
- GPKG memerlukan driver `GPKG` pada GDAL yang digunakan Pyogrio. Image Docker memasang GDAL dan dependency terkait.
- Pemuatan otomatis embedded QGIS style dapat bergantung pada versi dan pengaturan QGIS; field `style_color` tetap tersedia sebagai fallback.
- Basemap dan citra satelit tidak disimpan dalam GPKG karena output aplikasi hanya berisi feature vektor hasil konversi.
- File Google Drive diunduh ke memori browser sebelum dikirim ke backend. Untuk CSV ratusan MB, jalur upload perangkat lokal lebih hemat penggunaan memori browser.
- Semua feature dari satu CSV masih dimuat ke memori selama request setelah upload selesai. Upload disimpan sementara ke disk dan batas default naik menjadi 1 GB, tetapi CSV 700 MB tetap membutuhkan resource server yang besar saat Pandas/GeoPandas membangun output.

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
