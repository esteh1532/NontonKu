import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Trash2, Play, History, Bookmark, Tv } from "lucide-react";

import {
  daftarRiwayat,
  hapusRiwayat,
  daftarTersimpan,
  hapusTersimpan,
  type TersimpanItem,
} from "@/lib/koleksi";
import { Button } from "@/components/ui/button";

const JUDUL = "Tontonan saya — NontonKu";
const DESKRIPSI = "Riwayat tonton dan daftar film & series yang kamu simpan di NontonKu.";

export const Route = createFileRoute("/_authenticated/akun")({
  component: HalamanAkun,
  head: () => ({
    meta: [
      { title: JUDUL },
      { name: "description", content: DESKRIPSI },
      { property: "og:title", content: JUDUL },
      { property: "og:description", content: DESKRIPSI },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function waktu(t: string) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(t),
  );
}

function HalamanAkun() {
  const kueri = useQueryClient();
  const riwayat = useQuery({ queryKey: ["riwayat"], queryFn: () => daftarRiwayat() });
  const tersimpan = useQuery({ queryKey: ["koleksi"], queryFn: () => daftarTersimpan() });

  const hapusRiwayatMu = useMutation({
    mutationFn: (v: { mediaType: "movie" | "tv"; idTmdb: number }) =>
      hapusRiwayat({ data: v }),
    onSuccess: () => {
      kueri.invalidateQueries({ queryKey: ["riwayat"] });
      toast("Dihapus dari riwayat.");
    },
    onError: () => toast("Gagal menghapus. Coba lagi."),
  });

  const hapusTersimpanMu = useMutation({
    mutationFn: (v: { mediaType: "movie" | "tv"; idTmdb: number }) =>
      hapusTersimpan({ data: v }),
    onSuccess: () => {
      kueri.invalidateQueries({ queryKey: ["koleksi"] });
      toast("Dihapus dari daftar tersimpan.");
    },
    onError: () => toast("Gagal menghapus. Coba lagi."),
  });

  return (
    <main className="mx-auto w-full min-w-0 max-w-6xl px-4 pb-16">
      <h1 className="judul-bagian mt-6 text-3xl text-foreground">Tontonan saya</h1>

      <section className="mt-6">
        <h2 className="judul-bagian flex items-center gap-2 text-xl text-foreground">
          <History className="size-4 text-primary" />
          Riwayat tonton
        </h2>
        {riwayat.isLoading ? (
          <p className="mt-3 text-sm text-muted-foreground">Memuat…</p>
        ) : riwayat.data?.length ? (
          <ul className="mt-3 divide-y divide-border/60 overflow-hidden rounded-xl border border-border/60 bg-card">
            {riwayat.data.map((item) => (
              <li key={`${item.media_type}-${item.tmdb_id}`} className="flex items-center gap-3 p-3">
                {item.poster_path ? (
                  <img
                    src={`https://image.tmdb.org/t/p/w500${item.poster_path}`}
                    alt={`Poster ${item.title}`}
                    className="h-16 w-11 shrink-0 rounded-md object-cover"
                  />
                ) : (
                  <div className="h-16 w-11 shrink-0 rounded-md bg-muted" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 truncate text-sm font-medium">
                    {item.media_type === "tv" && <Tv className="size-3.5 shrink-0 text-primary/70" />}
                    <span className="truncate">{item.title}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {item.media_type === "tv" && item.episode_number
                      ? `S${item.season_number ?? 1} E${item.episode_number} · `
                      : ""}
                    Ditonton {waktu(item.updated_at)}
                  </p>
                </div>
                <Button
                  asChild
                  size="icon"
                  variant="ghost"
                  aria-label={`Lanjut menonton ${item.title}`}
                >
                  <Link
                    to="/nonton/$id"
                    params={{ id: String(item.tmdb_id) }}
                    search={{
                      jenis: item.media_type,
                      ...(item.season_number ? { s: item.season_number } : {}),
                      ...(item.episode_number ? { e: item.episode_number } : {}),
                    }}
                  >
                    <Play className="size-4" />
                  </Link>
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`Hapus ${item.title} dari riwayat`}
                  onClick={() =>
                    hapusRiwayatMu.mutate({ mediaType: item.media_type, idTmdb: item.tmdb_id })
                  }
                >
                  <Trash2 className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            Belum ada riwayat. Mulai menonton dari halaman utama.
          </p>
        )}
      </section>

      <section className="mt-10">
        <h2 className="judul-bagian flex items-center gap-2 text-xl text-foreground">
          <Bookmark className="size-4 text-primary" />
          Film & series tersimpan
        </h2>
        {tersimpan.isLoading ? (
          <p className="mt-3 text-sm text-muted-foreground">Memuat…</p>
        ) : tersimpan.data?.length ? (
          <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {tersimpan.data.map((item: TersimpanItem) => (
              <li
                key={`${item.media_type}-${item.tmdb_id}`}
                className="flex items-center gap-3 rounded-xl border border-border/60 bg-card p-3"
              >
                {item.poster_path ? (
                  <img
                    src={`https://image.tmdb.org/t/p/w500${item.poster_path}`}
                    alt={`Poster ${item.title}`}
                    className="h-20 w-14 shrink-0 rounded-md object-cover"
                  />
                ) : (
                  <div className="h-20 w-14 shrink-0 rounded-md bg-muted" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 text-sm font-medium">
                    {item.media_type === "tv" && <Tv className="size-3.5 shrink-0 text-primary/70" />}
                    <span className="truncate">{item.title}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {item.release_date?.slice(0, 4)}
                    {item.vote_average ? ` · ★ ${Number(item.vote_average).toFixed(1)}` : ""}
                  </p>
                </div>
                <Button asChild size="icon" variant="ghost" aria-label={`Tonton ${item.title}`}>
                  <Link
                    to="/nonton/$id"
                    params={{ id: String(item.tmdb_id) }}
                    search={{ jenis: item.media_type }}
                  >
                    <Play className="size-4" />
                  </Link>
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`Hapus ${item.title} dari daftar tersimpan`}
                  onClick={() =>
                    hapusTersimpanMu.mutate({ mediaType: item.media_type, idTmdb: item.tmdb_id })
                  }
                >
                  <Trash2 className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            Belum ada yang disimpan. Tekan "Simpan" di halaman pemutar.
          </p>
        )}
      </section>
    </main>
  );
}
