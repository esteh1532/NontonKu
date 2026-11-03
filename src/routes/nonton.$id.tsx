import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState, Suspense } from "react";
import { toast } from "sonner";
import {
  ChevronLeft,
  Star,
  Clock,
  Bookmark,
  BookmarkCheck,
  Play,
  ListVideo,
  Clapperboard,
} from "lucide-react";

import {
  opsiDetailFilm,
  opsiDetailSeries,
  opsiEpisode,
  opsiRekomendasi,
  type Jenis,
  type Episode,
  type DetailFilm,
  type DetailSeries,
} from "@/lib/tmdb";
import { catatRiwayat, cekTersimpan, setTersimpan } from "@/lib/koleksi";
import { useSesi } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const JUDUL_DASAR = "NontonKu — Tonton Film & Series Langsung";

/**
 * Daftar server pemutar. Urutan = urutan tombol di halaman.
 * - Server 1: Vidlink (utama, subtitle lengkap)
 * - Server 2: CineSrc (lengkap, ada lompat episode otomatis)
 * - Server 3: EmbedMaster (kualitas penuh)
 */
const DAFTAR_SERVER = [
  {
    nama: "Server 1",
    keterangan: "Utama · subtitle lengkap",
    alamat: (id: number, jenis: Jenis, musim: number, episode: number) =>
      jenis === "tv"
        ? `https://vidlink.pro/tv/${id}?s=${musim}&e=${episode}`
        : `https://vidlink.pro/movie/${id}`,
  },
  {
    nama: "Server 2",
    keterangan: "CineSrc · lompat episode otomatis",
    alamat: (id: number, jenis: Jenis, musim: number, episode: number) =>
      jenis === "tv"
        ? `https://cinesrc.st/embed/tv/${id}?s=${musim}&e=${episode}`
        : `https://cinesrc.st/embed/movie/${id}`,
  },
  {
    nama: "Server 3",
    keterangan: "EmbedMaster · kualitas penuh",
    alamat: (id: number, jenis: Jenis, _musim: number, _episode: number) =>
      jenis === "tv"
        ? `https://embedmaster.link/tv/${id}?s=${_musim}&e=${_episode}&skin=onyx&welcome_page=on&autoplay=off`
        : `https://embedmaster.link/movie/${id}?skin=onyx&welcome_page=on&autoplay=off`,
  },
] as const;

export const Route = createFileRoute("/nonton/$id")({
  validateSearch: (search: Record<string, unknown>) => {
    const hasil: { jenis?: "movie" | "tv"; s?: number; e?: number; server?: number } = {};
    hasil.jenis = search["jenis"] === "tv" ? "tv" : "movie";
    if (typeof search["s"] === "number" && search["s"] >= 1) hasil.s = Math.trunc(search["s"]);
    if (typeof search["e"] === "number" && search["e"] >= 1) hasil.e = Math.trunc(search["e"]);
    if (typeof search["server"] === "number")
      hasil.server = Math.min(Math.max(Math.trunc(search["server"]), 0), DAFTAR_SERVER.length - 1);
    return hasil;
  },
  loaderDeps: ({ search }) => ({ jenis: search.jenis, s: search.s }),
  loader: async ({ params, context, deps }) => {
    const id = Number(params.id);
    const jenis: Jenis = deps.jenis ?? "movie";
    const detail = (
      jenis === "tv"
        ? await context.queryClient.ensureQueryData(opsiDetailSeries(id))
        : await context.queryClient.ensureQueryData(opsiDetailFilm(id))
    ) as DetailFilm | DetailSeries;
    const tunggu: Promise<unknown>[] = [context.queryClient.ensureQueryData(opsiRekomendasi(jenis, id))];
    if (jenis === "tv") {
      tunggu.push(context.queryClient.ensureQueryData(opsiEpisode(id, deps.s ?? 1)));
    }
    await Promise.all(tunggu);
    return { judul: detail.judul, sinopsis: detail.sinopsis };
  },
  component: HalamanNonton,
  head: (ctx) => ({
    meta: [
      {
        title: ctx.loaderData?.judul
          ? `${ctx.loaderData.judul} — NontonKu`
          : `Tonton — ${JUDUL_DASAR}`,
      },
      {
        name: "description",
        content:
          ctx.loaderData?.sinopsis?.slice(0, 150) ||
          "Tonton film & series langsung dari browser, dengan pilihan server dan lanjutan tontonan.",
      },
      { property: "og:title", content: ctx.loaderData?.judul ?? JUDUL_DASAR },
      {
        property: "og:description",
        content: ctx.loaderData?.sinopsis?.slice(0, 150) || JUDUL_DASAR,
      },
      { property: "og:type", content: "video.movie" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

/** Baris rekomendasi untuk film: usulan dengan genre serupa film yang baru ditonton. */
function RekomendasiFilm({ id }: { id: number }) {
  const rekomendasi = useSuspenseQuery(opsiRekomendasi("movie", id));
  if (!rekomendasi.data.length) return null;
  return (
    <section className="mt-10">
      <h2 className="judul-bagian flex items-center gap-2 text-xl text-foreground">
        <Clapperboard className="size-4 text-primary" />
        Rekomendasi film selanjutnya
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Dipilih dari film dengan genre mirip seperti yang baru kamu tonton.
      </p>
      <div className="baris-gulir mt-3 flex gap-3 overflow-x-auto pb-2">
        {rekomendasi.data.map((film) => (
          <Link
            key={film.id}
            to="/nonton/$id"
            params={{ id: String(film.id) }}
            search={{ jenis: "movie" }}
            className="w-28 shrink-0 sm:w-36"
          >
            <div className="relative overflow-hidden rounded-xl bg-card shadow-layar">
              {film.poster ? (
                <img
                  src={film.poster}
                  alt={`Poster ${film.judul}`}
                  loading="lazy"
                  className="aspect-[2/3] w-full object-cover"
                />
              ) : (
                <div className="aspect-[2/3] w-full bg-card" />
              )}
              {film.rating > 0 && (
                <span className="absolute right-1.5 top-1.5 rounded-full bg-background/80 px-1.5 py-0.5 text-[11px] font-medium backdrop-blur">
                  ★ {film.rating.toFixed(1)}
                </span>
              )}
            </div>
            <p className="mt-1.5 truncate text-xs font-medium text-foreground">{film.judul}</p>
            <p className="text-[11px] text-muted-foreground">
              {film.rilis ? film.rilis.slice(0, 4) : ""}
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}

/** Series serupa, ditampilkan di halaman series. */
function RekomendasiSeries({ id }: { id: number }) {
  const rekomendasi = useSuspenseQuery(opsiRekomendasi("tv", id));
  if (!rekomendasi.data.length) return null;
  return (
    <section className="mt-10">
      <h2 className="judul-bagian flex items-center gap-2 text-xl text-foreground">
        <ListVideo className="size-4 text-primary" />
        Series lainnya
      </h2>
      <div className="baris-gulir mt-3 flex gap-3 overflow-x-auto pb-2">
        {rekomendasi.data.map((film) => (
          <Link
            key={film.id}
            to="/nonton/$id"
            params={{ id: String(film.id) }}
            search={{ jenis: "tv" }}
            className="w-28 shrink-0 sm:w-36"
          >
            <div className="relative overflow-hidden rounded-xl bg-card shadow-layar">
              {film.poster ? (
                <img
                  src={film.poster}
                  alt={`Poster ${film.judul}`}
                  loading="lazy"
                  className="aspect-[2/3] w-full object-cover"
                />
              ) : (
                <div className="aspect-[2/3] w-full bg-card" />
              )}
              {film.rating > 0 && (
                <span className="absolute right-1.5 top-1.5 rounded-full bg-background/80 px-1.5 py-0.5 text-[11px] font-medium backdrop-blur">
                  ★ {film.rating.toFixed(1)}
                </span>
              )}
            </div>
            <p className="mt-1.5 truncate text-xs font-medium text-foreground">{film.judul}</p>
            <p className="text-[11px] text-muted-foreground">
              {film.rilis ? film.rilis.slice(0, 4) : ""}
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}

interface DaftarEpisodeProps {
  id: number;
  musim: number;
  episodeAktif: number;
  episodeSumber: number;
  musimTersedia: { nomor: number; nama: string }[];
  onPilih: (musim: number, episode: number) => void;
}

/** Daftar episode satu musim + pemilih musim, seperti daftar tontonan berikutnya. */
function DaftarEpisode({
  id,
  musim,
  episodeAktif,
  episodeSumber,
  musimTersedia,
  onPilih,
}: DaftarEpisodeProps) {
  const daftar = useSuspenseQuery(opsiEpisode(id, musim));
  const episodes = daftar.data;
  const nomorBerikutnya = episodeAktif + 1;

  return (
    <section className="mt-10">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:flex sm:items-center sm:justify-between">
        <h2 className="judul-bagian flex min-w-0 items-center gap-2 text-xl text-foreground">
          <ListVideo className="size-4 shrink-0 text-primary" />
          <span className="truncate">Episode · Musim {musim}</span>
        </h2>
        {musimTersedia.length > 1 && (
          <div className="baris-gulir flex max-w-[55vw] gap-1.5 overflow-x-auto pb-1 sm:max-w-none">
            {musimTersedia.map((m) => (
              <button
                key={m.nomor}
                type="button"
                onClick={() => onPilih(m.nomor, 1)}
                className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  musim === m.nomor
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground hover:text-foreground"
                }`}
              >
                {m.nomor}
              </button>
            ))}
          </div>
        )}
      </div>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {episodes.map((ep: Episode) => {
          const aktif = ep.nomor === episodeSumber;
          const berikutnya = ep.nomor === nomorBerikutnya && episodeSumber === episodeAktif;
          return (
            <li key={ep.nomor}>
              <button
                type="button"
                onClick={() => onPilih(musim, ep.nomor)}
                className={`flex w-full items-center gap-3 rounded-xl border p-2.5 text-left transition-colors ${
                  aktif
                    ? "border-primary bg-primary/10"
                    : "border-border/60 bg-card hover:bg-accent/40"
                }`}
              >
                {ep.gambar ? (
                  <img
                    src={ep.gambar}
                    alt={`Episode ${ep.nomor}`}
                    loading="lazy"
                    className="h-14 w-24 shrink-0 rounded-md object-cover"
                  />
                ) : (
                  <div className="flex h-14 w-24 shrink-0 items-center justify-center rounded-md bg-muted">
                    <Play className="size-4 fill-current text-muted-foreground" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <span className="shrink-0 text-xs font-semibold text-primary">E{ep.nomor}</span>
                    <span className="truncate">{ep.judul}</span>
                  </p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {ep.tayang ? new Date(ep.tayang).toLocaleDateString("id-ID", { dateStyle: "medium" }) : ""}
                  </p>
                  {aktif && (
                    <p className="mt-0.5 text-[11px] font-medium text-primary">Sedang ditonton</p>
                  )}
                  {!aktif && berikutnya && (
                    <p className="mt-0.5 text-[11px] font-medium text-primary/90">Tonton berikutnya</p>
                  )}
                </div>
              </button>
            </li>
          );
        })}
      </ul>
      {episodes.length === 0 && (
        <p className="mt-3 text-sm text-muted-foreground">
          Daftar episode untuk musim ini belum tersedia.
        </p>
      )}
    </section>
  );
}

function HalamanNonton() {
  const { id: idParam } = Route.useParams();
  const { jenis, s: musimUrl, e: episodeUrl, server: idxServer = 0 } = Route.useSearch();
  const id = Number(idParam);
  const navigate = useNavigate();
  const kueri = useQueryClient();
  const { sesi } = useSesi();

  // State episode: `episode` untuk tampilan, `sumber` untuk apa yang dimainkan iframe.
  const [musim, setMusim] = useState(musimUrl ?? 1);
  const [episode, setEpisode] = useState(episodeUrl ?? 1);
  const [musimSumber, setMusimSumber] = useState(musimUrl ?? 1);
  const [episodeSumber, setEpisodeSumber] = useState(episodeUrl ?? 1);
  const pemutarRef = useRef<HTMLDivElement>(null);
  const [blokirIklan, setBlokirIklan] = useState(true);
  useEffect(() => {
    if (localStorage.getItem("blokirIklan") === "0") setBlokirIklan(false);
  }, []);
  useEffect(() => {
    localStorage.setItem("blokirIklan", blokirIklan ? "1" : "0");
  }, [blokirIklan]);
  // Cegah iklan membuka jendela baru dari halaman ini.
  useEffect(() => {
    if (!blokirIklan) return;
    const asli = window.open;
    window.open = () => null;
    return () => {
      window.open = asli;
    };
  }, [blokirIklan]);

  const isTv = jenis === "tv";
  const jenisAktif: Jenis = isTv ? "tv" : "movie";
  const detailFilmQ = useQuery({ ...opsiDetailFilm(id), enabled: !isTv });
  const detailSeriesQ = useQuery({ ...opsiDetailSeries(id), enabled: isTv });
  const detail = (isTv ? detailSeriesQ.data : detailFilmQ.data) as DetailFilm | DetailSeries | undefined;

  // Sinkronkan state ketika pengguna datang dari halaman lain (riwayat, rekomendasi).
  useEffect(() => {
    setMusim(musimUrl ?? 1);
    setEpisode(episodeUrl ?? 1);
    setMusimSumber(musimUrl ?? 1);
    setEpisodeSumber(episodeUrl ?? 1);
  }, [id, musimUrl, episodeUrl]);

  // Catat riwayat tonton setiap kali judul/episode dimainkan.
  useEffect(() => {
    if (!sesi || !detail) return;
    catatRiwayat({
      data: {
        mediaType: jenisAktif,
        idTmdb: id,
        judul: detail.judul,
        poster: detail.poster,
        musim: isTv ? musimSumber : null,
        episode: isTv ? episodeSumber : null,
      },
    })
      .then(() => kueri.invalidateQueries({ queryKey: ["riwayat"] }))
      .catch(() => {});
  }, [sesi, detail, id, jenis, isTv, musimSumber, episodeSumber, kueri]);

  // Server 2 (CineSrc): ikuti pergantian episode di dalam pemutar tanpa memuat ulang iframe.
  useEffect(() => {
    if (!isTv || idxServer !== 1) return;
    function onPesan(ev: MessageEvent) {
      if (ev.origin !== "https://cinesrc.st") return;
      const data = ev.data as { type?: string; season?: number; episode?: number; internalNavigation?: boolean };
      if (data?.type !== "cinesrc:nextepisode" || data.internalNavigation === false) return;
      const s = Number(data.season);
      const e = Number(data.episode);
      if (s >= 1 && e >= 1) {
        setMusim(s);
        setEpisode(e);
      }
    }
    window.addEventListener("message", onPesan);
    return () => window.removeEventListener("message", onPesan);
  }, [isTv, idxServer]);

  const server = DAFTAR_SERVER[idxServer] ?? DAFTAR_SERVER[0];
  const alamat = useMemo(
    () => server.alamat(id, jenisAktif, musimSumber, episodeSumber),
    [server, id, jenisAktif, musimSumber, episodeSumber],
  );

  const tersimpan = useQuery({
    queryKey: ["tersimpan", jenisAktif, id],
    queryFn: () => cekTersimpan({ data: { mediaType: jenisAktif, idTmdb: id } }),
    enabled: !!sesi,
  });

  async function toggleSimpan() {
    if (!sesi) {
      toast("Masuk dulu untuk menyimpan.");
      return;
    }
    const nilai = !tersimpan.data;
    try {
      await setTersimpan({
        data: {
          simpan: nilai,
          mediaType: jenisAktif,
          film: {
            idTmdb: id,
            judul: detail!.judul,
            poster: detail!.poster,
            sinopsis: detail!.sinopsis,
            rilis: detail!.rilis,
            rating: detail!.rating,
          },
        },
      });
      kueri.setQueryData(["tersimpan", jenisAktif, id], nilai);
      kueri.invalidateQueries({ queryKey: ["koleksi"] });
      toast(nilai ? "Disimpan untuk ditonton nanti." : "Dihapus dari daftar tersimpan.");
    } catch {
      toast("Gagal menyimpan. Coba lagi sebentar.");
    }
  }

  function pilihEpisode(m: number, e: number) {
    setMusim(m);
    setEpisode(e);
    setMusimSumber(m);
    setEpisodeSumber(e);
    navigate({
      to: "/nonton/$id",
      params: { id: idParam },
      search: (prev) => ({ ...prev, s: m, e }),
      replace: true,
    });
    pemutarRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function pilihServer(t: number) {
    navigate({
      to: "/nonton/$id",
      params: { id: idParam },
      search: (prev) => ({ ...prev, server: t }),
    });
  }

  if (!detail) {
    return (
      <main className="mx-auto w-full min-w-0 max-w-5xl px-4 pb-16">
        <p className="mt-10 text-sm text-muted-foreground">Memuat…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full min-w-0 max-w-5xl px-4 pb-16">
      <Link
        to="/"
        search={jenis === "tv" ? { jenis: "tv" } : {}}
        className="mt-4 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="size-4" />
        Kembali
      </Link>

      {/* Pemilih server */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {DAFTAR_SERVER.map((s, t) => (
          <button
            key={s.nama}
            type="button"
            onClick={() => pilihServer(t)}
            className={`rounded-full border px-4 py-1.5 text-sm transition-colors ${
              idxServer === t
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:text-foreground"
            }`}
          >
            {s.nama}
            <span className="ml-1.5 hidden text-xs opacity-75 sm:inline">{s.keterangan}</span>
          </button>
        ))}
      </div>

      {/* Pemutar */}
      <div
        ref={pemutarRef}
        className="mt-3 overflow-hidden rounded-xl border border-border/60 bg-black shadow-layar"
      >
        <iframe
          key={`${server.nama}-${id}-${isTv}-${musimSumber}-${episodeSumber}-${blokirIklan}`}
          src={alamat}
          title={`Pemutar ${server.nama} — ${detail?.judul ?? ""}`}
          className="aspect-video w-full"
          allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
          allowFullScreen
          referrerPolicy="origin"
          // Tanpa allow-popups & allow-top-navigation: iklan tidak bisa membuka tab baru / mengalihkan halaman.
          sandbox={
            blokirIklan
              ? "allow-scripts allow-same-origin allow-forms allow-presentation allow-orientation-lock"
              : undefined
          }
        />
      </div>
      <div className="mt-2 flex flex-col items-center gap-1.5 text-center text-xs text-muted-foreground">
        <label className="inline-flex cursor-pointer items-center gap-2 font-medium text-foreground">
          <input
            type="checkbox"
            checked={blokirIklan}
            onChange={(e) => setBlokirIklan(e.target.checked)}
            className="size-4 accent-primary"
          />
          Blokir iklan & pop-up
        </label>
        <p>
          Film tidak muncul? Pindah server dulu. Kalau server tetap menolak, matikan blokir iklan sebentar.
        </p>
      </div>

      {/* Info judul */}
      <section className="mt-6">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 sm:flex sm:flex-wrap sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="judul-bagian text-3xl leading-none text-foreground sm:text-4xl">
              {detail?.judul}
            </h1>
            <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Star className="size-4 fill-primary text-primary" />
                {(detail?.rating ?? 0).toFixed(1)}
              </span>
              {!!detail?.rilis && <span>{detail.rilis.slice(0, 4)}</span>}
              {isTv && (
                <span className="rounded-full border border-border bg-card px-2 py-0.5 text-xs">
                  Series · S{musim} E{episode}
                </span>
              )}
              {!isTv && !!(detail as DetailFilm).durasi_menit && (
                <span className="flex items-center gap-1">
                  <Clock className="size-4" />
                  {(detail as DetailFilm).durasi_menit} menit
                </span>
              )}
            </p>
          </div>
          <Button
            variant={tersimpan.data ? "secondary" : "default"}
            onClick={toggleSimpan}
            disabled={!!sesi && tersimpan.isLoading}
            className="shrink-0"
          >
            {tersimpan.data ? (
              <>
                <BookmarkCheck className="size-4" />
                Tersimpan
              </>
            ) : (
              <>
                <Bookmark className="size-4" />
                Simpan
              </>
            )}
          </Button>
        </div>

        {(detail as DetailFilm).genres?.length ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {(detail as DetailFilm).genres.map((g) => (
              <Badge key={g.id} variant="secondary">
                {g.nama}
              </Badge>
            ))}
          </div>
        ) : null}

        {detail?.sinopsis && (
          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            {detail.sinopsis}
          </p>
        )}
      </section>

      {/* Daftar episode untuk series — seperti daftar tontonan berikutnya */}
      {isTv && detail && (
        <Suspense
          fallback={<p className="mt-10 text-sm text-muted-foreground">Memuat daftar episode…</p>}
        >
          <DaftarEpisode
            id={id}
            musim={musim}
            episodeAktif={episode}
            episodeSumber={episodeSumber}
            musimTersedia={(detail as DetailSeries).musim.map((m) => ({
              nomor: m.nomor,
              nama: m.nama,
            }))}
            onPilih={pilihEpisode}
          />
        </Suspense>
      )}

      {/* Rekomendasi selanjutnya */}
      <Suspense fallback={null}>
        {isTv ? <RekomendasiSeries id={id} /> : <RekomendasiFilm id={id} />}
      </Suspense>
    </main>
  );
}
