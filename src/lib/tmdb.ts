/**
 * Penghubung ke TMDB (The Movie Database).
 *
 * Semua data film & series — judul, poster, sinopsis, genre, rating — diambil
 * dari TMDB. Kunci API disimpan sebagai rahasia server, sehingga seluruh
 * permintaan melewati fungsi server di file ini.
 */
import { createServerFn } from "@tanstack/react-start";
import { queryOptions } from "@tanstack/react-query";

export type Jenis = "movie" | "tv";

/** Bentuk film/series yang dipakai di seluruh aplikasi. */
export interface Film {
  id: number;
  judul: string;
  sinopsis: string;
  poster: string | null;
  latar: string | null;
  rilis: string;
  rating: number;
  /** Jenis konten; terisi pada hasil pencarian gabungan. */
  jenis?: Jenis;
}

export interface Halaman<T> {
  hasil: T[];
  halaman: number;
  totalHalaman: number;
}

export interface Genre {
  id: number;
  nama: string;
}

export interface DetailFilm extends Film {
  durasi_menit: number | null;
  genres: Genre[];
}

export interface Musim {
  nomor: number;
  nama: string;
  jumlah_episode: number;
  tahun: string | null;
}

export interface DetailSeries extends Film {
  genres: Genre[];
  jumlah_musim: number;
  durasi_menit: number | null;
  status: string | null;
  musim: Musim[];
}

export interface Episode {
  nomor: number;
  judul: string;
  sinopsis: string;
  tayang: string | null;
  gambar: string | null;
  durasi_menit: number | null;
}

const ALAMAT_TMDB = "https://api.themoviedb.org/3";
const ALAMAT_GAMBAR = "https://image.tmdb.org/t/p";

/** Permintaan sederhana ke TMDB, selalu dalam bahasa Indonesia. */
async function mintaTmdb(jalur: string, parameter: Record<string, string> = {}) {
  const kunci = (process.env["TMDB_API_KEY"] ?? process.env["TMDB_API_TOKEN"] ?? "").trim();
  if (!kunci) throw new Error("Kunci TMDB belum diatur (TMDB_API_KEY).");
  const url = new URL(ALAMAT_TMDB + jalur);
  // Mendukung "API Key" (pendek) maupun "Read Access Token" (panjang, diawali eyJ).
  const pakaiToken = kunci.startsWith("eyJ");
  if (!pakaiToken) url.searchParams.set("api_key", kunci);
  url.searchParams.set("language", "id-ID");
  for (const [k, v] of Object.entries(parameter)) url.searchParams.set(k, v);
  const jawaban = await fetch(url, {
    headers: pakaiToken ? { Authorization: `Bearer ${kunci}`, accept: "application/json" } : {},
  });
  if (!jawaban.ok) throw new Error(`TMDB menolak permintaan (${jawaban.status}).`);
  return await jawaban.json();
}

/** Ubah satu hasil TMDB menjadi bentuk Film yang rapi untuk aplikasi. */
function keFilm(h: Record<string, unknown>): Film {
  return {
    id: h["id"] as number,
    judul: (h["title"] as string) ?? (h["name"] as string) ?? "Tanpa judul",
    sinopsis: (h["overview"] as string) ?? "",
    poster: h["poster_path"] ? `${ALAMAT_GAMBAR}/w500${h["poster_path"]}` : null,
    latar: h["backdrop_path"] ? `${ALAMAT_GAMBAR}/w1280${h["backdrop_path"]}` : null,
    rilis: (h["release_date"] as string) ?? (h["first_air_date"] as string) ?? "",
    rating: (h["vote_average"] as number) ?? 0,
    ...(h["media_type"] === "movie" || h["media_type"] === "tv"
      ? { jenis: h["media_type"] as Jenis }
      : {}),
  };
}

/** TMDB hanya melayani maksimal 500 halaman. */
const HALAMAN_MAKS = 500;

function bersihkanHalaman(nilai: unknown): number {
  const n = Math.trunc(Number(nilai));
  return Number.isFinite(n) ? Math.min(Math.max(n, 1), HALAMAN_MAKS) : 1;
}

/** Katalog beranda: trending atau film/series per genre, dengan nomor halaman yang benar. */
const ambilPopuler = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => input as {
    jenis: Jenis;
    genre?: number;
    halaman?: number;
  })
  .handler(async ({ data }): Promise<Halaman<Film>> => {
    const jenis = data.jenis === "tv" ? "tv" : "movie";
    const halaman = bersihkanHalaman(data.halaman);
    let jalur: string;
    const parameter: Record<string, string> = { page: String(halaman) };
    if (data.genre) {
      jalur = `/discover/${jenis}`;
      parameter["with_genres"] = String(Math.trunc(Number(data.genre)));
      parameter["sort_by"] = "popularity.desc";
      parameter["include_adult"] = "false";
      parameter["vote_count.gte"] = "50";
    } else {
      // Sebelumnya parameter halaman tidak ikut terkirim di sini, sehingga
      // tombol "Berikutnya" selalu menampilkan hasil yang sama.
      jalur = `/trending/${jenis}/week`;
    }
    const h = await mintaTmdb(jalur, parameter);
    return {
      hasil: (h.results as Record<string, unknown>[]).map(keFilm),
      halaman,
      totalHalaman: Math.min(Number(h.total_pages) || 1, HALAMAN_MAKS),
    };
  });

/** Pencarian gabungan: film dan series sekaligus berdasarkan judul. */
const cariSemua = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => input as { kata: string; halaman?: number })
  .handler(async ({ data }): Promise<Halaman<Film>> => {
    const kata = String(data.kata ?? "").trim().slice(0, 100);
    const halaman = bersihkanHalaman(data.halaman);
    if (!kata) return { hasil: [], halaman: 1, totalHalaman: 1 };
    const h = await mintaTmdb("/search/multi", {
      query: kata,
      page: String(halaman),
      include_adult: "false",
    });
    const hasil = (h.results as Record<string, unknown>[])
      .filter((r) => r["media_type"] === "movie" || r["media_type"] === "tv")
      .map(keFilm);
    return {
      hasil,
      halaman,
      totalHalaman: Math.min(Number(h.total_pages) || 1, HALAMAN_MAKS),
    };
  });

/** Daftar genre untuk tombol penyaring. */
const ambilGenre = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => input as { jenis: Jenis })
  .handler(async ({ data }) => {
    const jenis = data.jenis === "tv" ? "tv" : "movie";
    return (await mintaTmdb(`/genre/${jenis}/list`)).genres.map((g: { id: number; name: string }) => ({
      id: g.id,
      nama: g.name,
    })) as Genre[];
  });

/** Detail lengkap satu film. */
const ambilDetailFilm = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => input as { id: number })
  .handler(async ({ data }): Promise<DetailFilm> => {
    const h = await mintaTmdb(`/movie/${data.id}`);
    return {
      ...keFilm(h),
      durasi_menit: (h["runtime"] as number) ?? null,
      genres: (h["genres"] as Genre[]) ?? [],
    };
  });

/** Detail lengkap satu series beserta daftar musimnya. */
const ambilDetailSeries = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => input as { id: number })
  .handler(async ({ data }): Promise<DetailSeries> => {
    const h = await mintaTmdb(`/tv/${data.id}`);
    const musim: Musim[] = ((h["seasons"] as Record<string, unknown>[]) ?? [])
      .filter((s) => (s["season_number"] as number) >= 1 && (s["episode_count"] as number) > 0)
      .map((s) => ({
        nomor: s["season_number"] as number,
        nama: (s["name"] as string) ?? `Musim ${s["season_number"]}`,
        jumlah_episode: (s["episode_count"] as number) ?? 0,
        tahun: (s["air_date"] as string)?.slice(0, 4) ?? null,
      }));
    return {
      ...keFilm(h),
      genres: (h["genres"] as Genre[]) ?? [],
      jumlah_musim: (h["number_of_seasons"] as number) ?? musim.length,
      durasi_menit: ((h["episode_run_time"] as number[] | undefined) ?? [])[0] ?? null,
      status: (h["status"] as string) ?? null,
      musim,
    };
  });

/** Daftar episode satu musim. */
const ambilEpisode = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => input as { id: number; musim: number })
  .handler(async ({ data }): Promise<Episode[]> => {
    const h = await mintaTmdb(`/tv/${data.id}/season/${data.musim}`);
    return ((h["episodes"] as Record<string, unknown>[]) ?? []).map((e) => ({
      nomor: (e["episode_number"] as number) ?? 0,
      judul: (e["name"] as string) ?? `Episode ${e["episode_number"]}`,
      sinopsis: (e["overview"] as string) ?? "",
      tayang: (e["air_date"] as string) ?? null,
      gambar: e["still_path"] ? `${ALAMAT_GAMBAR}/w300${e["still_path"]}` : null,
      durasi_menit: (e["runtime"] as number) ?? null,
    }));
  });

/**
 * Rekomendasi selanjutnya.
 * Diutamakan judul dengan genre yang sama seperti yang baru ditonton:
 * usulan TMDB (recommendations/similar) yang berbagi genre lebih dulu, lalu
 * dilengkapi judul populer dengan genre yang sama.
 */
const ambilRekomendasi = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => input as { jenis: Jenis; id: number })
  .handler(async ({ data }): Promise<Film[]> => {
    const jenis = data.jenis === "tv" ? "tv" : "movie";
    const h = await mintaTmdb(`/${jenis}/${data.id}`, {
      append_to_response: "recommendations,similar",
    });
    const idGenre = new Set<number>(
      Array.isArray(h.genres) ? (h.genres as { id: number }[]).map((g) => g.id) : [],
    );
    const bagiGenre = (f: Record<string, unknown>) => {
      const g = f["genre_ids"] as number[] | undefined;
      return idGenre.size === 0 || !g || g.some((x) => idGenre.has(x));
    };
    const kandidat: Record<string, unknown>[] = [
      ...((h.recommendations?.results as Record<string, unknown>[]) ?? []),
      ...((h.similar?.results as Record<string, unknown>[]) ?? []),
    ];
    const terlihat = new Set<number>([data.id]);
    let hasil = kandidat.filter((f) => {
      const id = f["id"] as number;
      if (terlihat.has(id) || !f["poster_path"] || !bagiGenre(f)) return false;
      terlihat.add(id);
      return true;
    });
    if (hasil.length < 8 && idGenre.size > 0) {
      const sekarang = new Date().toISOString().slice(0, 10);
      const parameter: Record<string, string> = {
        with_genres: [...idGenre].slice(0, 2).join(","),
        sort_by: "popularity.desc",
        include_adult: "false",
        "vote_count.gte": "50",
        [jenis === "movie" ? "primary_release_date.lte" : "first_air_date.lte"]: sekarang,
      };
      const cadangan = await mintaTmdb(`/discover/${jenis}`, parameter);
      for (const f of (cadangan.results as Record<string, unknown>[]) ?? []) {
        const id = f["id"] as number;
        if (terlihat.has(id) || !f["poster_path"]) continue;
        terlihat.add(id);
        hasil.push(f);
      }
    }
    return hasil.slice(0, 14).map(keFilm);
  });

/* ---------- Kueri siap pakai untuk halaman (client) ---------- */

export const opsiKatalog = (jenis: Jenis, genre?: number, halaman?: number) =>
  queryOptions({
    queryKey: ["katalog", jenis, genre ?? null, halaman ?? 1],
    queryFn: () => ambilPopuler({ data: { jenis, genre, halaman } }),
    staleTime: 5 * 60_000,
  });

export const opsiCari = (kata: string, halaman?: number) =>
  queryOptions({
    queryKey: ["cari", kata, halaman ?? 1],
    queryFn: () => cariSemua({ data: { kata, halaman } }),
    staleTime: 5 * 60_000,
  });

export const opsiGenre = (jenis: Jenis) =>
  queryOptions({
    queryKey: ["genre", jenis],
    queryFn: () => ambilGenre({ data: { jenis } }),
    staleTime: Infinity,
  });

export const opsiDetailFilm = (id: number) =>
  queryOptions({
    queryKey: ["detail", "movie", id],
    queryFn: () => ambilDetailFilm({ data: { id } }),
  });

export const opsiDetailSeries = (id: number) =>
  queryOptions({
    queryKey: ["detail", "tv", id],
    queryFn: () => ambilDetailSeries({ data: { id } }),
  });

export const opsiEpisode = (id: number, musim: number) =>
  queryOptions({
    queryKey: ["episode", id, musim],
    queryFn: () => ambilEpisode({ data: { id, musim } }),
  });

export const opsiRekomendasi = (jenis: Jenis, id: number) =>
  queryOptions({
    queryKey: ["rekomendasi", jenis, id],
    queryFn: () => ambilRekomendasi({ data: { jenis, id } }),
  });
