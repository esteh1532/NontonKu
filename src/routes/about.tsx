import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { toast } from "sonner";
import {
  Bookmark,
  Clapperboard,
  History,
  Info,
  LogIn,
  LogOut,
  Play,
  RotateCcw,
  Settings,
  Trash2,
  Tv,
  UserRound,
} from "lucide-react";

import {
  daftarRiwayat,
  hapusRiwayat,
  daftarTersimpan,
  hapusTersimpan,
  type TersimpanItem,
} from "@/lib/koleksi";
import { keluar, useSesi } from "@/lib/auth";
import { NAMA_APLIKASI } from "@/lib/konfigurasi";
import { resetPengaturan, ubahPengaturan, usePengaturan } from "@/lib/pengaturan";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const JUDUL = "About — NontonKu";
const DESKRIPSI = "Tentang NontonKu, akun, riwayat tonton, daftar tersimpan, dan pengaturan.";

export const Route = createFileRoute("/about")({
  component: HalamanAbout,
  head: () => ({
    meta: [
      { title: JUDUL },
      { name: "description", content: DESKRIPSI },
      { property: "og:title", content: JUDUL },
      { property: "og:description", content: DESKRIPSI },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function waktu(t: string) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(t),
  );
}

function BarisPengaturan({
  judul,
  keterangan,
  children,
}: {
  judul: string;
  keterangan: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-4">
      <div className="min-w-0">
        <p className="break-words text-sm font-medium text-foreground">{judul}</p>
        <p className="mt-0.5 break-words text-xs text-muted-foreground">{keterangan}</p>
      </div>
      <div className="shrink-0 pt-0.5">{children}</div>
    </div>
  );
}

function Pengaturan() {
  const p = usePengaturan();
  const server = ["Server 1", "Server 2", "Server 3"];
  return (
    <div>
      <div className="divide-y divide-border/60 rounded-xl border border-border/60 bg-card px-4">
        <BarisPengaturan
          judul="Putar otomatis berikutnya"
          keterangan="Saat tontonan selesai, episode berikutnya (series) atau film rekomendasi dengan genre serupa diputar otomatis setelah hitung mundur singkat."
        >
          <Switch
            checked={p.autoplay}
            onCheckedChange={(v) => ubahPengaturan({ autoplay: v })}
            aria-label="Putar otomatis berikutnya"
          />
        </BarisPengaturan>
        <BarisPengaturan
          judul="Server utama"
          keterangan="Server yang dipakai pertama kali saat membuka tontonan. Bisa diganti kapan saja di halaman pemutar."
        >
          <div className="flex gap-1 rounded-full bg-muted p-1" role="radiogroup" aria-label="Server utama">
            {server.map((nama, i) => (
              <button
                key={nama}
                type="button"
                role="radio"
                aria-checked={p.serverUtama === i}
                onClick={() => ubahPengaturan({ serverUtama: i })}
                className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                  p.serverUtama === i
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {i + 1}
              </button>
            ))}
          </div>
        </BarisPengaturan>
        <BarisPengaturan
          judul="Blokir iklan & pop-up"
          keterangan="Mencegah pemutar membuka tab iklan. Matikan jika sebuah server menolak diputar."
        >
          <Switch
            checked={p.blokirIklan}
            onCheckedChange={(v) => ubahPengaturan({ blokirIklan: v })}
            aria-label="Blokir iklan dan pop-up"
          />
        </BarisPengaturan>
        <BarisPengaturan
          judul="Popup donasi harian"
          keterangan="Muncul paling banyak sekali sehari, dan tidak pernah muncul saat kamu sedang menonton."
        >
          <Switch
            checked={p.popupDonasi}
            onCheckedChange={(v) => ubahPengaturan({ popupDonasi: v })}
            aria-label="Popup donasi harian"
          />
        </BarisPengaturan>
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="mt-3"
        onClick={() => {
          resetPengaturan();
          toast("Pengaturan dikembalikan ke bawaan.");
        }}
      >
        <RotateCcw className="size-4" />
        Kembalikan ke bawaan
      </Button>
      <p className="mt-2 text-xs text-muted-foreground">
        Pengaturan disimpan di perangkat ini.
      </p>
    </div>
  );
}

function Riwayat() {
  const kueri = useQueryClient();
  const riwayat = useQuery({ queryKey: ["riwayat"], queryFn: () => daftarRiwayat() });
  const hapus = useMutation({
    mutationFn: (v: { mediaType: "movie" | "tv"; idTmdb: number }) => hapusRiwayat({ data: v }),
    onSuccess: () => {
      kueri.invalidateQueries({ queryKey: ["riwayat"] });
      toast("Dihapus dari riwayat.");
    },
    onError: () => toast("Gagal menghapus. Coba lagi."),
  });

  if (riwayat.isLoading) return <p className="text-sm text-muted-foreground">Memuat…</p>;
  if (riwayat.isError)
    return <p className="text-sm text-muted-foreground">Riwayat gagal dimuat. Coba muat ulang halaman.</p>;
  if (!riwayat.data?.length)
    return (
      <p className="text-sm text-muted-foreground">
        Belum ada riwayat. Mulai menonton dari beranda.
      </p>
    );
  return (
    <ul className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border/60 bg-card">
      {riwayat.data.map((item) => (
        <li key={`${item.media_type}-${item.tmdb_id}`} className="flex items-center gap-3 p-3">
          {item.poster_path ? (
            <img
              src={`https://image.tmdb.org/t/p/w185${item.poster_path}`}
              alt={`Poster ${item.title}`}
              loading="lazy"
              className="h-16 w-11 shrink-0 rounded-md object-cover"
            />
          ) : (
            <div className="h-16 w-11 shrink-0 rounded-md bg-muted" />
          )}
          <div className="min-w-0 flex-1">
            <p className="flex items-start gap-1.5 text-sm font-medium">
              {item.media_type === "tv" && <Tv className="mt-0.5 size-3.5 shrink-0 text-primary/70" />}
              <span className="min-w-0 break-words">{item.title}</span>
            </p>
            <p className="break-words text-xs text-muted-foreground">
              {item.media_type === "tv" && item.episode_number
                ? `S${item.season_number ?? 1} E${item.episode_number} · `
                : ""}
              Ditonton {waktu(item.updated_at)}
            </p>
          </div>
          <Button asChild size="icon" variant="ghost" aria-label={`Lanjut menonton ${item.title}`}>
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
            onClick={() => hapus.mutate({ mediaType: item.media_type, idTmdb: item.tmdb_id })}
          >
            <Trash2 className="size-4" />
          </Button>
        </li>
      ))}
    </ul>
  );
}

function Tersimpan() {
  const kueri = useQueryClient();
  const tersimpan = useQuery({ queryKey: ["koleksi"], queryFn: () => daftarTersimpan() });
  const hapus = useMutation({
    mutationFn: (v: { mediaType: "movie" | "tv"; idTmdb: number }) => hapusTersimpan({ data: v }),
    onSuccess: () => {
      kueri.invalidateQueries({ queryKey: ["koleksi"] });
      kueri.invalidateQueries({ queryKey: ["tersimpan"] });
      toast("Dihapus dari daftar tersimpan.");
    },
    onError: () => toast("Gagal menghapus. Coba lagi."),
  });

  if (tersimpan.isLoading) return <p className="text-sm text-muted-foreground">Memuat…</p>;
  if (tersimpan.isError)
    return <p className="text-sm text-muted-foreground">Daftar gagal dimuat. Coba muat ulang halaman.</p>;
  if (!tersimpan.data?.length)
    return (
      <p className="text-sm text-muted-foreground">
        Belum ada yang disimpan. Tekan “Simpan” di halaman pemutar.
      </p>
    );
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {tersimpan.data.map((item: TersimpanItem) => (
        <li
          key={`${item.media_type}-${item.tmdb_id}`}
          className="flex items-center gap-3 rounded-xl border border-border/60 bg-card p-3"
        >
          {item.poster_path ? (
            <img
              src={`https://image.tmdb.org/t/p/w185${item.poster_path}`}
              alt={`Poster ${item.title}`}
              loading="lazy"
              className="h-20 w-14 shrink-0 rounded-md object-cover"
            />
          ) : (
            <div className="h-20 w-14 shrink-0 rounded-md bg-muted" />
          )}
          <div className="min-w-0 flex-1">
            <p className="flex items-start gap-1.5 text-sm font-medium">
              {item.media_type === "tv" && <Tv className="mt-0.5 size-3.5 shrink-0 text-primary/70" />}
              <span className="min-w-0 break-words">{item.title}</span>
            </p>
            <p className="text-xs text-muted-foreground">
              {item.release_date?.slice(0, 4)}
              {item.vote_average ? ` · ★ ${Number(item.vote_average).toFixed(1)}` : ""}
            </p>
          </div>
          <Button asChild size="icon" variant="ghost" aria-label={`Tonton ${item.title}`}>
            <Link to="/nonton/$id" params={{ id: String(item.tmdb_id) }} search={{ jenis: item.media_type }}>
              <Play className="size-4" />
            </Link>
          </Button>
          <Button
            size="icon"
            variant="ghost"
            aria-label={`Hapus ${item.title} dari daftar tersimpan`}
            onClick={() => hapus.mutate({ mediaType: item.media_type, idTmdb: item.tmdb_id })}
          >
            <Trash2 className="size-4" />
          </Button>
        </li>
      ))}
    </ul>
  );
}

function HalamanAbout() {
  const { sesi, memuat } = useSesi();
  const navigate = useNavigate();

  async function keluarAkun() {
    await keluar();
    toast("Sampai jumpa lagi!");
    await navigate({ to: "/", replace: true });
  }

  return (
    <main className="mx-auto w-full min-w-0 max-w-3xl px-4 pb-16">
      <section className="mt-6 rounded-2xl border border-border/60 bg-card p-5 shadow-layar">
        <div className="flex items-center gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
            <Clapperboard className="size-6" />
          </div>
          <div className="min-w-0">
            <h1 className="judul-bagian text-3xl leading-none text-foreground">{NAMA_APLIKASI}</h1>
            <p className="mt-1 text-sm text-muted-foreground">Tonton film & series langsung dari browser.</p>
          </div>
        </div>
        <p className="mt-4 break-words text-sm leading-relaxed text-muted-foreground">
          Cari judul, pilih server pemutar, dan lanjutkan tontonanmu di perangkat mana pun. Masuk dengan
          akun untuk menyimpan riwayat tonton dan daftar film atau series favorit.
        </p>
        <p className="mt-3 break-words text-xs text-muted-foreground">
          Data film & series berasal dari TMDB. Aplikasi ini memakai API TMDB tetapi tidak didukung atau
          disertifikasi oleh TMDB. Video diputar dari server pihak ketiga; {NAMA_APLIKASI} tidak
          menyimpan file video.
        </p>
      </section>

      <section className="mt-6">
        {memuat ? (
          <p className="text-sm text-muted-foreground">Memuat…</p>
        ) : sesi ? (
          <>
            <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-card p-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted">
                  <UserRound className="size-5 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Masuk sebagai</p>
                  <p className="break-all text-sm font-semibold text-foreground">
                    {sesi.idPengguna || "Pengguna"}
                  </p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={keluarAkun} className="shrink-0">
                <LogOut className="size-4" />
                Keluar
              </Button>
            </div>

            <Tabs defaultValue="riwayat" className="mt-6">
              <TabsList className="grid h-auto w-full grid-cols-3">
                <TabsTrigger value="riwayat" className="gap-1.5">
                  <History className="size-4" />
                  Riwayat
                </TabsTrigger>
                <TabsTrigger value="tersimpan" className="gap-1.5">
                  <Bookmark className="size-4" />
                  Tersimpan
                </TabsTrigger>
                <TabsTrigger value="pengaturan" className="gap-1.5">
                  <Settings className="size-4" />
                  Pengaturan
                </TabsTrigger>
              </TabsList>
              <TabsContent value="riwayat" className="mt-4">
                <Riwayat />
              </TabsContent>
              <TabsContent value="tersimpan" className="mt-4">
                <Tersimpan />
              </TabsContent>
              <TabsContent value="pengaturan" className="mt-4">
                <Pengaturan />
              </TabsContent>
            </Tabs>
          </>
        ) : (
          <>
            <div className="rounded-xl border border-border/60 bg-card p-4">
              <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Info className="size-4 text-primary" />
                Belum masuk
              </p>
              <p className="mt-1 break-words text-sm text-muted-foreground">
                Masuk untuk menyimpan riwayat tonton dan daftar tersimpan yang tersambung di semua
                perangkat.
              </p>
              <Button asChild className="mt-3">
                <Link to="/auth" search={{ lanjut: "/about" }}>
                  <LogIn className="size-4" />
                  Masuk atau daftar
                </Link>
              </Button>
            </div>
            <h2 className="judul-bagian mt-8 flex items-center gap-2 text-xl text-foreground">
              <Settings className="size-4 text-primary" />
              Pengaturan
            </h2>
            <div className="mt-3">
              <Pengaturan />
            </div>
          </>
        )}
      </section>
    </main>
  );
}
