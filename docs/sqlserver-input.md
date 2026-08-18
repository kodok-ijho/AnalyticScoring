# Input MS SQL Server

iScore sekarang menyediakan dua sumber input: upload Excel dan query MS SQL
Server. Jalur Excel tetap diproses seperti sebelumnya.

## Menjalankan

1. Pastikan Microsoft ODBC Driver 18 for SQL Server terpasang.
2. Dari folder `backend`, install dan jalankan API:

   ```powershell
   python -m pip install -e ".[dev]"
   python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
   ```

3. Dari root proyek, jalankan frontend dengan `npm run dev`.

Frontend meneruskan `/api` ke backend melalui konfigurasi Vite.

## Alur pengguna

1. Pilih `Tarik data dari MS SQL Server` pada layar awal.
2. Isi hostname, username, dan password, lalu tekan `Connect & Muat Database`.
3. Pilih database. `DesSy` diprioritaskan bila tersedia.
4. Pilih MPG, periode mulai/akhir, lalu buka `Edit Query SQL` bila query perlu
   disesuaikan.
5. Tekan `Tarik Data & Analisis`.

Query default memakai `@MPG`, `@PeriodeStart`, dan `@PeriodeEnd`. Nilai tersebut
disuplai backend dengan parameter binding dari kontrol form. Query yang diedit
harus tetap berupa satu statement `SELECT`/CTE read-only.

Password tidak disimpan di browser. Hostname, username, database terakhir, dan
query terakhir disimpan agar form tidak perlu diisi ulang. Untuk akses intranet,
gunakan HTTPS/reverse proxy; jangan meneruskan kredensial melalui HTTP biasa.
