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
  const kunci = (process.env["TMDB_API_KEY"] ?? process.env["TMDB_TOKEN"] ?? "").trim();
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
  };
}

/** Katalog halaman utama: trending, hasil pencarian, atau film/series per genre. */
const ambilPopuler = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => input as {
    jenis: Jenis;
    cari?: string;
    genre?: number;
    halaman?: number;
  })
  .handler(async ({ data }) => {
    const jenis = data.jenis === "tv" ? "tv" : "movie";
    const halaman = String(Math.max(1, Math.trunc(data.halaman ?? 1)));
    let jalur: string;
    let parameter: Record<string, string> = { page: halaman };
    if (data.cari) {
      jalur = `/search/${jenis}`;
      parameter = { ...parameter, query: data.cari, include_adult: "false" };
    } else if (data.genre) {
      jalur = `/discover/${jenis}`;
      parameter = {
        ...parameter,
        with_genres: String(data.genre),
        sort_by: "popularity.desc",
        include_adult: "false",
        "vote_count.gte": "50",
      };
    } else {
      jalur = `/trending/${jenis}/week`;
      parameter = {};
    }
    return (await mintaTmdb(jalur, parameter)).results.map(keFilm) as Film[];
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
      durasi_menit: (h["episode_run_time"] as number[])[0] ?? null,
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
 * Film: usulan TMDB (similar/recommendations), bila kurang dilengkapi
 * film populer dengan genre yang sama seperti film yang baru ditonton.
 * Series: series serupa.
 */
const ambilRekomendasi = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => input as { jenis: Jenis; id: number })
  .handler(async ({ data }): Promise<Film[]> => {
    const jenis = data.jenis === "tv" ? "tv" : "movie";
    const h = await mintaTmdb(`/${jenis}/${data.id}`, { append_to_response: "recommendations,similar" });
    let hasil: Record<string, unknown>[] = [
      ...((h.recommendations?.results as Record<string, unknown>[]) ?? []),
      ...((h.similar?.results as Record<string, unknown>[]) ?? []),
    ];
    const terlihat = new Set<number>([data.id]);
    hasil = hasil.filter((f) => {
      const id = f["id"] as number;
      if (terlihat.has(id) || !f["poster_path"]) return false;
      terlihat.add(id);
      return true;
    });
    if (hasil.length < 6 && Array.isArray(h.genres) && h.genres.length > 0) {
      const parameter: Record<string, string> = {
        with_genres: String(h.genres[0].id),
        sort_by: "popularity.desc",
        include_adult: "false",
        "vote_count.gte": "50",
      };
      if (jenis === "movie") parameter["primary_release_date.lte"] = new Date().toISOString().slice(0, 10);
      else parameter["first_air_date.lte"] = new Date().toISOString().slice(0, 10);
      const cadangan = await mintaTmdb(`/discover/${jenis}`, parameter);
      hasil = [...hasil, ...((cadangan.results as Record<string, unknown>[]) ?? [])];
    }
    return hasil.slice(0, 12).map(keFilm);
  });

/* ---------- Kueri siap pakai untuk halaman (client) ---------- */

export const opsiKatalog = (jenis: Jenis, cari?: string, genre?: number, halaman?: number) =>
  queryOptions({
    queryKey: ["katalog", jenis, cari ?? null, genre ?? null, halaman ?? 1],
    queryFn: () => ambilPopuler({ data: { jenis, cari, genre, halaman } }),
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
