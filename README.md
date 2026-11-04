# NontonKu

Website streaming film dan series: jelajahi katalog populer, cari judul di film dan series sekaligus,
pilih server pemutar, simpan riwayat dan daftar tontonan.

## Fitur

- **Beranda**: film/series populer mingguan, filter genre, pindah Film ↔ Series, dan halaman berikutnya.
- **Pencarian**: satu kolom untuk film *dan* series sekaligus berdasarkan judul.
- **Pemutar**: 3 server, layar penuh tanpa celah, daftar episode, putar otomatis episode/film berikutnya
  dengan genre yang sama.
- **Akun** (ID + kata sandi, tanpa email): riwayat tonton dan film/series tersimpan.
- **About → Pengaturan**: putar otomatis, server utama, blokir iklan, popup donasi harian.

## Menjalankan

```sh
bun install        # atau: npm install
cp .env.example .env   # lalu isi nilainya
bun run dev        # atau: npm run dev
```

Skrip lain: `bun run build`, `bun run test`, `bun run lint`.

## Konfigurasi

| Variabel | Fungsi |
| --- | --- |
| `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` (+ versi `VITE_`) | Akun, riwayat, dan daftar tersimpan |
| `TMDB_API_KEY` | Data film & series (hanya dipakai di server) |

Tautan donasi diatur di `src/lib/konfigurasi.ts` (`TAUTAN_DONASI`).

Skema database ada di `drizzle/migrations/0000_nontonku_tables.sql`.

## Teknologi

TanStack Start, React, TypeScript, Tailwind CSS, Supabase, TMDB API.

Data film & series berasal dari TMDB. Aplikasi ini memakai API TMDB tetapi tidak didukung atau
disertifikasi oleh TMDB.
