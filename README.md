# CSV Coverage Grid Converter

Mengubah setiap baris koordinat CSV menjadi grid polygon **153 m × 153 m** yang sejajar dan tidak saling menimpa. Output tersedia sebagai **KML** untuk Google Earth atau **GeoPackage (GPKG)** untuk QGIS.

Tidak ada database atau penyimpanan permanen. Baris dengan koordinat tidak valid akan dilewati dan dilaporkan.

## Format CSV

Header standar yang langsung terdeteksi:

```csv
geohash7,latitude_geohash7,longitude_geohash7,avg_rsrp,total_subscriber_count,red_cov_category
qqwxbvr,-7.04567,110.434,-105.316,43,RED ENGINEERING
qqwxbvs,-7.04610,110.435,-98.210,28,BAD NON POTENTIAL
```

Simpan file uji di folder `sample-data/`. Folder tersebut diabaikan Git sehingga data lokal tidak ikut ter-commit.

## Opsi 1 — CLI dengan Docker

Ini cara paling ringkas karena hanya membutuhkan Docker; tidak perlu memasang Node.js, Python, GDAL, atau dependency aplikasi satu per satu.

Build image satu kali dari root project:

```bash
docker build -t csv-grid-converter ./backend
```

Konversi ke GPKG pada Linux/macOS:

```bash
docker run --rm --user "$(id -u):$(id -g)" -v "$PWD:/data" csv-grid-converter \
  python -m app.cli /data/sample-data/input.csv --format gpkg
```

Konversi ke KML:

```bash
docker run --rm --user "$(id -u):$(id -g)" -v "$PWD:/data" csv-grid-converter \
  python -m app.cli /data/sample-data/input.csv --format kml
```

Di Windows PowerShell, gunakan `${PWD}` dan hilangkan opsi `--user`:

```powershell
docker run --rm -v "${PWD}:/data" csv-grid-converter `
  python -m app.cli /data/sample-data/input.csv --format gpkg
```

Hasil otomatis dibuat di sebelah CSV sebagai `input_grid.gpkg` atau `input_grid.kml`. Tambahkan `--force` untuk mengganti output yang sudah ada.

Jika nama kolom berbeda dari header standar:

```bash
docker run --rm --user "$(id -u):$(id -g)" -v "$PWD:/data" csv-grid-converter \
  python -m app.cli /data/sample-data/input.csv --format gpkg \
  --longitude-column lon \
  --latitude-column lat \
  --name-column grid_id \
  --category-column category
```

Lihat semua opsi:

```bash
python -m app.cli --help
```

## Opsi 2 — CLI lokal tanpa frontend

Opsi ini hanya membutuhkan Python dan dependency backend; Node.js tidak diperlukan.

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m app.cli ../sample-data/input.csv --format gpkg
```

Pada Windows, aktifkan virtual environment dengan:

```powershell
.venv\Scripts\Activate.ps1
```

## Opsi 3 — Web dengan Docker

Jalankan frontend dan backend sekaligus:

```bash
docker compose up --build
```

Buka http://localhost:3000. Hentikan dengan `Ctrl+C`.

## Opsi 4 — Web untuk development

Install dependency backend satu kali:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
cd ..
```

Install dependency frontend satu kali:

```bash
cd frontend
npm install
cd ..
```

Setelah itu jalankan frontend dan backend dari root project:

```bash
npm run dev
```

Buka http://localhost:3000. Backend berjalan di http://localhost:8000 dan dokumentasi API tersedia di http://localhost:8000/docs.

Upload dari perangkat dapat digunakan tanpa konfigurasi tambahan. Tombol Google Drive bersifat opsional dan membutuhkan credential pada `frontend/.env.local`; lihat `frontend/.env.example` untuk nama variable yang diperlukan.

## Hasil konversi

- `coverage_grid`: polygon grid dengan warna berdasarkan `red_cov_category`.
- `coverage_points`: titik longitude-latitude asli dengan satu warna merah.
- `RED ENGINEERING`: merah.
- `RED OPTIM`: kuning.
- `BAD NON POTENTIAL`: hijau.
- `NOT RED COV`: biru.

GPKG tidak membawa basemap. Tambahkan satellite/XYZ Tiles secara terpisah di QGIS. Untuk melihat atribut, gunakan **Identify Features** atau **Open Attribute Table**.

## Test

```bash
cd backend
source .venv/bin/activate
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 pytest -q
```

File CSV besar tetap membutuhkan RAM dan temporary disk yang cukup karena Pandas dan GeoPandas memuat data saat membangun geometry. KML biasanya jauh lebih besar daripada GPKG; gunakan GPKG untuk dataset besar.
