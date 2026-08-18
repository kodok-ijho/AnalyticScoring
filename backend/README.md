# iScore SQL Server backend

Backend ini menyediakan koneksi read-only ke SQL Server untuk jalur input kedua
iScore. Password hanya dikirim dalam request aktif dan tidak disimpan oleh
service.

## Prasyarat

- Python 3.11+
- Microsoft ODBC Driver 18 for SQL Server
- `pip install -e ".[dev]"` dari direktori `backend`

## Menjalankan lokal

```powershell
cd backend
python -m pip install -e ".[dev]"
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

Di terminal lain, jalankan frontend dari root proyek:

```powershell
npm run dev
```

Vite meneruskan request `/api` ke backend lokal. Untuk akses intranet, gunakan
reverse proxy HTTPS dan ubah `ISCORE_API_HOST` sesuai jaringan deployment.

## Kontrak query

Frontend mengirim query body yang dimulai `WITH` atau `SELECT`. Backend menambahkan
parameter ter-bind berikut sebelum eksekusi:

- `@MPG`
- `@PeriodeStart`
- `@PeriodeEnd`

Hanya satu query read-only yang diizinkan; DML, DDL, `EXEC`, `SELECT INTO`, dan
multi-statement ditolak.
