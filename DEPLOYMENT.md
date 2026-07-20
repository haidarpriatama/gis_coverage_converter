# Deployment production

## Arsitektur

Gunakan dua deployment terpisah:

```text
Browser -> Vercel (frontend Next.js)
        -> HTTPS langsung ke backend Docker (FastAPI + GDAL)
```

Backend tidak ditempatkan di Vercel Functions. Request/response Vercel Functions dibatasi 4,5 MB, sedangkan converter menerima CSV hingga 1 GB. Jangan membuat Next.js API proxy untuk upload karena file besar akan kembali terkena limit tersebut.

## 1. Deploy backend Docker

Deploy folder `backend` ke penyedia container/VM yang:

- menerima request body minimal sebesar `MAX_UPLOAD_SIZE_MB`;
- menyediakan temporary disk sekurangnya dua kali ukuran file terbesar;
- memiliki RAM yang cukup untuk Pandas, GeoPandas, dan hasil geometri;
- mendukung timeout request panjang dan streaming response;
- menyediakan HTTPS dan rate limiting pada proxy/WAF.

Build dan uji image:

```bash
docker build -t csv-coverage-backend ./backend
docker run --rm -p 8000:8000 \
  -e ENVIRONMENT=production \
  -e FRONTEND_ORIGINS=https://your-project.vercel.app \
  -e TRUSTED_HOSTS=api.example.com \
  -e MAX_UPLOAD_SIZE_MB=1024 \
  csv-coverage-backend
```

Environment production backend:

```env
ENVIRONMENT=production
FRONTEND_ORIGINS=https://your-project.vercel.app
TRUSTED_HOSTS=api.example.com
MAX_UPLOAD_SIZE_MB=1024
PORT=8000
WEB_CONCURRENCY=1
FORWARDED_ALLOW_IPS=127.0.0.1
```

Gunakan satu worker terlebih dahulu karena setiap konversi file besar memakai RAM tinggi. Atur proxy agar request body, read timeout, dan response streaming tidak dipotong. Terapkan rate limit per IP di proxy/WAF; aplikasi sengaja tidak memiliki akun/login sehingga endpoint konversi tetap merupakan endpoint publik.

Verifikasi:

```bash
curl --fail --show-error https://api.example.com/api/health
```

## 2. Deploy frontend ke Vercel

Import repository GitHub ke Vercel, lalu atur:

- **Framework Preset:** Next.js
- **Root Directory:** `frontend`
- **Install Command:** `npm ci`
- **Build Command:** `npm run build`
- **Node.js:** 22.x

Tambahkan environment variable untuk Production dan Preview sesuai kebutuhan:

```env
NEXT_PUBLIC_API_BASE_URL=https://api.example.com
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
NEXT_PUBLIC_GOOGLE_API_KEY=your-restricted-browser-key
NEXT_PUBLIC_GOOGLE_APP_ID=your-google-project-number
```

`NEXT_PUBLIC_API_BASE_URL` wajib berupa URL HTTPS backend tanpa path `/api`. Build Vercel sengaja dibuat gagal jika variable ini tidak tersedia supaya frontend tidak diam-diam menunjuk localhost.

Build production memakai Webpack. Next.js 16.2.10 masih membawa PostCSS lama yang terkena advisory moderat; project melakukan override ke PostCSS yang sudah dipatch. Webpack tervalidasi kompatibel dengan override tersebut, sedangkan Turbopack production build pada versi ini dapat macet saat kompilasi CSS.

Deploy melalui dashboard/Git integration, atau dari folder frontend:

```bash
npx vercel
npx vercel --prod
```

## 3. Google Cloud setelah domain Vercel tersedia

Di OAuth Client ID tambahkan production domain ke **Authorized JavaScript origins**, misalnya:

```text
https://your-project.vercel.app
```

Pada API key:

- pilih restriction **Websites**;
- batasi HTTP referrer ke domain production yang tepat;
- API restriction hanya ke Google Picker API dan Google Drive API;
- jangan commit `.env.local` atau menaruh credential pada dokumentasi.

API key browser bukan secret server, tetapi tetap harus dibatasi. Jika key pernah dibagikan di tempat yang tidak semestinya, rotasi key sebelum production.

## 4. CORS preview deployment

Backend hanya menerima origin yang terdaftar eksplisit. Untuk menguji deployment preview, tambahkan URL preview ke `FRONTEND_ORIGINS` dengan pemisah koma lalu restart backend:

```env
FRONTEND_ORIGINS=https://your-project.vercel.app,https://your-preview.vercel.app
```

Jangan menggunakan `*` pada production.

## 5. Pemeriksaan setelah deploy

Dari root repository:

```bash
backend/.venv/bin/python scripts/production_check.py \
  --frontend-url https://your-project.vercel.app \
  --backend-url https://api.example.com \
  --csv sample-data/redcov_banyumanik.csv
```

Pemeriksaan tersebut memvalidasi:

- security headers frontend dan backend;
- health endpoint dan latency median/p95;
- CORS origin production serta penolakan origin asing;
- penolakan file non-CSV;
- inspect CSV dan konversi KML sungguhan;
- waktu respons dan ukuran output.

Untuk performance test yang representatif, jalankan ulang menggunakan salinan CSV production yang tidak sensitif. Jangan menjalankan load test berat ke production tanpa memastikan kapasitas dan biaya host backend.

## Checklist keamanan

- Semua URL production memakai HTTPS.
- `FRONTEND_ORIGINS` dan `TRUSTED_HOSTS` berisi nilai eksplisit.
- Rate limit/WAF aktif pada `/api/csv/inspect` dan `/api/convert`.
- Proxy membatasi request body sesuai `MAX_UPLOAD_SIZE_MB`.
- Temporary disk dimonitor dan container dijalankan sebagai non-root.
- Google API key dibatasi berdasarkan referrer dan API.
- GitHub CI, Dependabot, `npm audit`, dan `pip-audit` aktif.
- Log tidak merekam isi CSV, token Google, atau internal temporary path.
