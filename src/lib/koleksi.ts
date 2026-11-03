/**
 * Modul koleksi: riwayat tonton dan daftar film/series tersimpan.
 *
 * Semua fungsi di sini hanya boleh dijalankan oleh pengguna yang sudah masuk.
 * Kepemilikan data dijaga oleh aturan keamanan database (setiap pengguna
 * hanya melihat barisnya sendiri), dan fungsi ini tetap menyaring berdasarkan
 * ID akun yang terverifikasi dari sesi.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Jenis } from "@/lib/tmdb";

export interface RiwayatItem {
  tmdb_id: number;
  media_type: Jenis;
  title: string;
  poster_path: string | null;
  season_number: number | null;
  episode_number: number | null;
  updated_at: string;
}

export interface TersimpanItem {
  tmdb_id: number;
  media_type: Jenis;
  title: string;
  poster_path: string | null;
  overview: string | null;
  release_date: string | null;
  vote_average: number | null;
  added_at: string;
}

export interface FilmSimpan {
  idTmdb: number;
  judul: string;
  poster: string | null;
  sinopsis: string;
  rilis: string;
  rating: number;
}

/** Riwayat tonton terbaru (maksimal 30). */
export const daftarRiwayat = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<RiwayatItem[]> => {
    const { data, error } = await context.supabase
      .from("watch_history")
      .select("tmdb_id, media_type, title, poster_path, season_number, episode_number, updated_at")
      .order("updated_at", { ascending: false })
      .limit(30);
    if (error) throw new Error(error.message);
    return (data ?? []) as RiwayatItem[];
  });

/** Catat (atau perbarui) satu judul sebagai baru ditonton. */
export const catatRiwayat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => input as {
    mediaType: Jenis;
    idTmdb: number;
    judul: string;
    poster: string | null;
    musim?: number | null;
    episode?: number | null;
  })
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("watch_history").upsert(
      {
        user_id: context.userId,
        media_type: data.mediaType,
        tmdb_id: data.idTmdb,
        title: data.judul,
        poster_path: data.poster,
        season_number: data.musim ?? null,
        episode_number: data.episode ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,media_type,tmdb_id" },
    );
    if (error) throw new Error(error.message);
    return { sukses: true };
  });

export const hapusRiwayat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => input as { mediaType: Jenis; idTmdb: number })
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("watch_history")
      .delete()
      .match({ user_id: context.userId, media_type: data.mediaType, tmdb_id: data.idTmdb });
    if (error) throw new Error(error.message);
    return { sukses: true };
  });

/** Daftar film/series yang disimpan pengguna. */
export const daftarTersimpan = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<TersimpanItem[]> => {
    const { data, error } = await context.supabase
      .from("watchlist")
      .select("tmdb_id, media_type, title, poster_path, overview, release_date, vote_average, added_at")
      .order("added_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as TersimpanItem[];
  });

/** Apakah satu judul sudah tersimpan? */
export const cekTersimpan = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => input as { mediaType: Jenis; idTmdb: number })
  .handler(async ({ data, context }): Promise<boolean> => {
    const { data: baris } = await context.supabase
      .from("watchlist")
      .select("tmdb_id")
      .match({ user_id: context.userId, media_type: data.mediaType, tmdb_id: data.idTmdb })
      .maybeSingle();
    return !!baris;
  });

/** Simpan atau hapus satu judul dari daftar tersimpan. */
export const setTersimpan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => input as {
    simpan: boolean;
    mediaType: Jenis;
    film: FilmSimpan;
  })
  .handler(async ({ data, context }) => {
    if (!data.simpan) {
      const { error } = await context.supabase
        .from("watchlist")
        .delete()
        .match({ user_id: context.userId, media_type: data.mediaType, tmdb_id: data.film.idTmdb });
      if (error) throw new Error(error.message);
      return { sukses: true };
    }
    const { error } = await context.supabase.from("watchlist").upsert(
      {
        user_id: context.userId,
        media_type: data.mediaType,
        tmdb_id: data.film.idTmdb,
        title: data.film.judul,
        poster_path: data.film.poster,
        overview: data.film.sinopsis,
        release_date: data.film.rilis,
        vote_average: data.film.rating,
      },
      { onConflict: "user_id,media_type,tmdb_id" },
    );
    if (error) throw new Error(error.message);
    return { sukses: true };
  });

export const hapusTersimpan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => input as { mediaType: Jenis; idTmdb: number })
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("watchlist")
      .delete()
      .match({ user_id: context.userId, media_type: data.mediaType, tmdb_id: data.idTmdb });
    if (error) throw new Error(error.message);
    return { sukses: true };
  });
