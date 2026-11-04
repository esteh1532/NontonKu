import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState, Suspense } from "react";
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
  Maximize,
  Minimize,
  SkipForward,
  X,
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
import { ubahPengaturan, usePengaturan } from "@/lib/pengaturan";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const JUDUL_DASAR = "NontonKu — Tonton Film & Series Langsung";
const JEDA_AUTOPLAY_DETIK = 8;

/**
 * Daftar server pemutar. Urutan = urutan tombol di halaman.
 * Catatan format alamat series: Server 1 (Vidlink) dan Server 3 (EmbedMaster)
 * memakai bentuk jalur /tv/{id}/{musim}/{episode}. Server 2 (CineSrc) memakai
 * parameter ?s=&e=. Memakai format yang salah membuat series selalu error.
 */
const DAFTAR_SERVER = [
  {
    nama: "Server 1",
    keterangan: "Utama · subtitle lengkap",
    alamat: (id: number, jenis: Jenis, musim: number, episode: number, otomatis: boolean) => {
      const dasar =
        jenis === "tv"
          ? `https://vidlink.pro/tv/${id}/${musim}/${episode}`
          : `https://vidlink.pro/movie/${id}`;
      return otomatis ? `${dasar}?autoplay=true` : dasar;
    },
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
    alamat: (id: number, jenis: Jenis, musim: number, episode: number, otomatis: boolean) => {
      const dasar =
        jenis === "tv"
          ? `https://embedmaster.link/tv/${id}/${musim}/${episode}`
          : `https://embedmaster.link/movie/${id}`;
      return otomatis
        ? `${dasar}?skin=onyx&welcome_page=off&autoplay=on`
        : `${dasar}?skin=onyx&welcome_page=on&autoplay=off`;
    },
  },
] as const;

const ASAL_PEMUTAR = new Set(["https://vidlink.pro", "https://cinesrc.st", "https://embedmaster.link"]);

type CarianNonton = { jenis: "movie" | "tv"; s?: number; e?: number; server?: number };

export const Route = createFileRoute("/nonton/$id")({
  validateSearch: (search: Record<string, unknown>): CarianNonton => {
    const hasil: CarianNonton = { jenis: search["jenis"] === "tv" ? "tv" : "movie" };
    const s = Number(search["s"]);
    const e = Number(search["e"]);
    const server = Number(search["server"]);
    if (Number.isInteger(s) && s >= 1) hasil.s = s;
    if (Number.isInteger(e) && e >= 1) hasil.e = e;
    if (Number.isInteger(server))
      hasil.server = Math.min(Math.max(server, 0), DAFTAR_SERVER.length - 1);
    return hasil;
  },
  loaderDeps: ({ search }) => ({ jenis: search.jenis, s: search.s }),
  loader: async ({ params, context, deps }) => {
    const id = Number(params.id);
    if (!Number.isInteger(id) || id <= 0) throw notFound();
    const jenis: Jenis = deps.jenis ?? "movie";
    let detail: DetailFilm | DetailSeries;
    try {
      detail = (
        jenis === "tv"
          ? await context.queryClient.ensureQueryData(opsiDetailSeries(id))
          : await context.queryClient.ensureQueryData(opsiDetailFilm(id))
      ) as DetailFilm | DetailSeries;
    } catch (galat) {
      if (galat instanceof Error && galat.message.includes("(404)")) throw notFound();
      throw galat;
    }
    const tunggu: Promise<unknown>[] = [
      context.queryClient.ensureQueryData(opsiRekomendasi(jenis, id)),
    ];
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
        title: ctx.loaderData?.judul ? `${ctx.loaderData.judul} — NontonKu` : `Tonton — ${JUDUL_DASAR}`,
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

/* ---------- Riwayat pemutaran dalam satu sesi (cegah autoplay berputar) ---------- */

const KUNCI_SESI = "nontonku:diputar";

function bacaDiputar(): string[] {
  try {
    const nilai = JSON.parse(sessionStorage.getItem(KUNCI_SESI) ?? "[]") as unknown;
    return Array.isArray(nilai) ? nilai.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function tandaiDiputar(kunci: string) {
  try {
    const daftar = bacaDiputar();
    if (!daftar.includes(kunci)) sessionStorage.setItem(KUNCI_SESI, JSON.stringify([...daftar, kunci].slice(-60)));
  } catch {
    /* abaikan */
  }
}

/* ---------- Rekomendasi ---------- */

function BarisRekomendasi({ jenis, id }: { jenis: Jenis; id: number }) {
  const rekomendasi = useSuspenseQuery(opsiRekomendasi(jenis, id));
  if (!rekomendasi.data.length) return null;
  const tv = jenis === "tv";
  return (
    <section className="mt-10">
      <h2 className="judul-bagian flex items-center gap-2 text-xl text-foreground">
        {tv ? (
          <ListVideo className="size-4 text-primary" />
        ) : (
          <Clapperboard className="size-4 text-primary" />
        )}
        {tv ? "Series serupa" : "Rekomendasi film selanjutnya"}
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Dipilih dari {tv ? "series" : "film"} dengan genre yang sama seperti yang sedang kamu tonton.
      </p>
      <div className="baris-gulir mt-3 flex gap-3 overflow-x-auto pb-2">
        {rekomendasi.data.map((film) => (
          <Link
            key={film.id}
            to="/nonton/$id"
            params={{ id: String(film.id) }}
            search={{ jenis }}
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
            <p className="mt-1.5 line-clamp-2 break-words text-xs font-medium leading-snug text-foreground">
              {film.judul}
            </p>
            <p className="text-[11px] text-muted-foreground">{film.rilis ? film.rilis.slice(0, 4) : ""}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}

/* ---------- Daftar episode ---------- */

interface DaftarEpisodeProps {
  id: number;
  /** Musim yang daftarnya sedang ditampilkan. */
  musim: number;
  musimDiputar: number;
  episodeDiputar: number;
  musimTersedia: { nomor: number; nama: string }[];
  onPilih: (musim: number, episode: number) => void;
  onGantiMusim: (musim: number) => void;
}

function DaftarEpisode({
  id,
  musim,
  musimDiputar,
  episodeDiputar,
  musimTersedia,
  onPilih,
  onGantiMusim,
}: DaftarEpisodeProps) {
  const daftar = useSuspenseQuery(opsiEpisode(id, musim));
  const episodes = daftar.data;
  const urutan = [...episodes].sort((a, b) => a.nomor - b.nomor);
  const indeksAktif = urutan.findIndex((e) => musim === musimDiputar && e.nomor === episodeDiputar);
  const nomorBerikutnya = indeksAktif >= 0 ? urutan[indeksAktif + 1]?.nomor : undefined;

  return (
    <section className="mt-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="judul-bagian flex min-w-0 items-center gap-2 text-xl text-foreground">
          <ListVideo className="size-4 shrink-0 text-primary" />
          <span className="break-words">Episode · Musim {musim}</span>
        </h2>
        {musimTersedia.length > 1 && (
          <div
            className="baris-gulir flex max-w-full gap-1.5 overflow-x-auto pb-1"
            role="tablist"
            aria-label="Pilih musim"
          >
            {musimTersedia.map((m) => (
              <button
                key={m.nomor}
                type="button"
                role="tab"
                aria-selected={musim === m.nomor}
                onClick={() => onGantiMusim(m.nomor)}
                className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  musim === m.nomor
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground hover:text-foreground"
                }`}
              >
                Musim {m.nomor}
              </button>
            ))}
          </div>
        )}
      </div>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {urutan.map((ep: Episode) => {
          const aktif = musim === musimDiputar && ep.nomor === episodeDiputar;
          const berikutnya = !aktif && ep.nomor === nomorBerikutnya;
          return (
            <li key={ep.nomor} className="min-w-0">
              <button
                type="button"
                onClick={() => onPilih(musim, ep.nomor)}
                className={`flex w-full items-center gap-3 rounded-xl border p-2.5 text-left transition-colors ${
                  aktif ? "border-primary bg-primary/10" : "border-border/60 bg-card hover:bg-accent/40"
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
                  <p className="flex items-start gap-2 text-sm font-medium text-foreground">
                    <span className="shrink-0 text-xs font-semibold text-primary">E{ep.nomor}</span>
                    <span className="line-clamp-2 min-w-0 break-words">{ep.judul}</span>
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {ep.tayang
                      ? new Date(ep.tayang).toLocaleDateString("id-ID", { dateStyle: "medium" })
                      : ""}
                  </p>
                  {aktif && <p className="mt-0.5 text-[11px] font-medium text-primary">Sedang ditonton</p>}
                  {berikutnya && (
                    <p className="mt-0.5 text-[11px] font-medium text-primary/90">Tonton berikutnya</p>
                  )}
                </div>
              </button>
            </li>
          );
        })}
      </ul>
      {episodes.length === 0 && (
        <p className="mt-3 text-sm text-muted-foreground">Daftar episode untuk musim ini belum tersedia.</p>
      )}
    </section>
  );
}

/* ---------- Halaman utama pemutar ---------- */

interface Berikutnya {
  kunci: string;
  label: string;
  jalankan: () => void;
}

function HalamanNonton() {
  const { id: idParam } = Route.useParams();
  const { jenis, s: musimUrl, e: episodeUrl, server: serverUrl } = Route.useSearch();
  const id = Number(idParam);
  const navigate = useNavigate();
  const kueri = useQueryClient();
  const { sesi } = useSesi();
  const pengaturan = usePengaturan();
  const idxServer = serverUrl ?? Math.min(pengaturan.serverUtama, DAFTAR_SERVER.length - 1);

  // `musim`: musim yang daftarnya sedang dibuka. `...Diputar`: episode yang sedang ditonton
  // (bisa berubah karena CineSrc berpindah sendiri). `...Sumber`: alamat yang dimuat iframe,
  // hanya berubah lewat pilihan pengguna agar iframe tidak dimuat ulang tanpa perlu.
  const [musim, setMusim] = useState(musimUrl ?? 1);
  const [musimDiputar, setMusimDiputar] = useState(musimUrl ?? 1);
  const [episodeDiputar, setEpisodeDiputar] = useState(episodeUrl ?? 1);
  const [musimSumber, setMusimSumber] = useState(musimUrl ?? 1);
  const [episodeSumber, setEpisodeSumber] = useState(episodeUrl ?? 1);
  const [otomatis, setOtomatis] = useState(false);
  const [selesai, setSelesai] = useState(false);
  const [dibatalkan, setDibatalkan] = useState(false);
  const [hitung, setHitung] = useState<number | null>(null);
  const [layarPenuh, setLayarPenuh] = useState(false);
  const pemutarRef = useRef<HTMLDivElement>(null);

  const isTv = jenis === "tv";
  const jenisAktif: Jenis = isTv ? "tv" : "movie";
  const detailFilmQ = useQuery({ ...opsiDetailFilm(id), enabled: !isTv });
  const detailSeriesQ = useQuery({ ...opsiDetailSeries(id), enabled: isTv });
  const detail = (isTv ? detailSeriesQ.data : detailFilmQ.data) as DetailFilm | DetailSeries | undefined;
  const episodeQ = useQuery({ ...opsiEpisode(id, musimDiputar), enabled: isTv });
  const rekomendasiQ = useQuery(opsiRekomendasi(jenisAktif, id));

  // Sinkronkan state ketika pengguna datang dari halaman lain (riwayat, rekomendasi).
  useEffect(() => {
    setMusim(musimUrl ?? 1);
    setMusimDiputar(musimUrl ?? 1);
    setEpisodeDiputar(episodeUrl ?? 1);
    setMusimSumber(musimUrl ?? 1);
    setEpisodeSumber(episodeUrl ?? 1);
  }, [id, musimUrl, episodeUrl]);

  // Setiap judul/episode/server baru: hapus status "selesai" sebelumnya.
  useEffect(() => {
    setSelesai(false);
    setDibatalkan(false);
    setHitung(null);
  }, [id, musimDiputar, episodeDiputar, idxServer]);

  useEffect(() => {
    tandaiDiputar(`${jenisAktif}-${id}`);
  }, [jenisAktif, id]);

  // Catat riwayat tonton setiap kali judul/episode dimainkan.
  useEffect(() => {
    if (!sesi || !detail) return;
    catatRiwayat({
      data: {
        mediaType: jenisAktif,
        idTmdb: id,
        judul: detail.judul,
        poster: detail.poster,
        musim: isTv ? musimDiputar : null,
        episode: isTv ? episodeDiputar : null,
      },
    })
      .then(() => kueri.invalidateQueries({ queryKey: ["riwayat"] }))
      .catch(() => {});
  }, [sesi, detail, id, jenisAktif, isTv, musimDiputar, episodeDiputar, kueri]);

  // Pesan dari pemutar: pergantian episode internal (CineSrc) dan tanda tontonan selesai.
  useEffect(() => {
    function onPesan(ev: MessageEvent) {
      if (!ASAL_PEMUTAR.has(ev.origin)) return;
      let isi: unknown = ev.data;
      if (typeof isi === "string") {
        try {
          isi = JSON.parse(isi);
        } catch {
          return;
        }
      }
      if (!isi || typeof isi !== "object") return;
      const o = isi as Record<string, unknown>;
      const tipe = typeof o["type"] === "string" ? o["type"] : "";

      if (ev.origin === "https://cinesrc.st") {
        // CineSrc berpindah episode sendiri; cukup ikuti tampilannya.
        if (tipe === "cinesrc:nextepisode" && o["internalNavigation"] !== false) {
          const s = Number(o["season"]);
          const e = Number(o["episode"]);
          if (s >= 1 && e >= 1) {
            setMusim(s);
            setMusimDiputar(s);
            setEpisodeDiputar(e);
          }
          return;
        }
        if (jenis === "tv") return;
      }

      const dalam = o["data"] && typeof o["data"] === "object" ? (o["data"] as Record<string, unknown>) : {};
      const nama = typeof dalam["event"] === "string" ? dalam["event"] : "";
      if (/ended$/i.test(tipe) || nama === "ended") {
        setSelesai(true);
        return;
      }
      if (nama === "timeupdate") {
        const t = Number(dalam["currentTime"]);
        const total = Number(dalam["duration"]);
        if (total > 60 && t > 0 && total - t <= 2) setSelesai(true);
      }
    }
    window.addEventListener("message", onPesan);
    return () => window.removeEventListener("message", onPesan);
  }, [jenis]);

  // Layar penuh pada kotak pemutar sendiri (tanpa celah di tepi).
  useEffect(() => {
    function ubah() {
      const el = pemutarRef.current;
      const aktif =
        !!el &&
        (document.fullscreenElement === el ||
          (document as Document & { webkitFullscreenElement?: Element }).webkitFullscreenElement === el);
      setLayarPenuh(aktif);
      if (!aktif) {
        try {
          screen.orientation?.unlock?.();
        } catch {
          /* tidak didukung */
        }
      }
    }
    document.addEventListener("fullscreenchange", ubah);
    document.addEventListener("webkitfullscreenchange", ubah);
    return () => {
      document.removeEventListener("fullscreenchange", ubah);
      document.removeEventListener("webkitfullscreenchange", ubah);
    };
  }, []);

  async function toggleLayarPenuh() {
    const el = pemutarRef.current as (HTMLDivElement & { webkitRequestFullscreen?: () => void }) | null;
    if (!el) return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else if (el.requestFullscreen) {
        await el.requestFullscreen();
        try {
          await (screen.orientation as unknown as { lock?: (o: string) => Promise<void> })?.lock?.("landscape");
        } catch {
          /* tidak semua perangkat mengizinkan kunci orientasi */
        }
      } else if (el.webkitRequestFullscreen) {
        el.webkitRequestFullscreen();
      } else {
        toast("Gunakan tombol layar penuh di dalam pemutar.");
      }
    } catch {
      toast("Layar penuh tidak tersedia. Gunakan tombol layar penuh di dalam pemutar.");
    }
  }

  const server = DAFTAR_SERVER[idxServer] ?? DAFTAR_SERVER[0];
  const alamat = useMemo(
    () => server.alamat(id, jenisAktif, musimSumber, episodeSumber, otomatis),
    [server, id, jenisAktif, musimSumber, episodeSumber, otomatis],
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
    if (!detail) return;
    const nilai = !tersimpan.data;
    try {
      await setTersimpan({
        data: {
          simpan: nilai,
          mediaType: jenisAktif,
          film: {
            idTmdb: id,
            judul: detail.judul,
            poster: detail.poster,
            sinopsis: detail.sinopsis,
            rilis: detail.rilis,
            rating: detail.rating,
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

  const pilihEpisode = useCallback(
    (m: number, e: number, dariOtomatis = false) => {
      setMusim(m);
      setMusimDiputar(m);
      setEpisodeDiputar(e);
      setMusimSumber(m);
      setEpisodeSumber(e);
      setOtomatis(dariOtomatis);
      navigate({
        to: "/nonton/$id",
        params: { id: idParam },
        search: (prev) => ({ ...prev, s: m, e }),
        replace: true,
      });
      pemutarRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    },
    [navigate, idParam],
  );

  function pilihServer(t: number) {
    setOtomatis(false);
    navigate({
      to: "/nonton/$id",
      params: { id: idParam },
      search: (prev) => ({ ...prev, server: t }),
      replace: true,
    });
  }

  /** Apa yang diputar setelah ini: episode berikutnya (series) atau film rekomendasi sama genre. */
  const berikutnya: Berikutnya | null = useMemo(() => {
    if (isTv) {
      const urutan = [...(episodeQ.data ?? [])].sort((a, b) => a.nomor - b.nomor);
      const indeks = urutan.findIndex((e) => e.nomor === episodeDiputar);
      if (indeks < 0) return null;
      const sudahTayang = (e: Episode) => !e.tayang || new Date(e.tayang).getTime() <= Date.now();
      const lanjut = urutan[indeks + 1];
      if (lanjut && sudahTayang(lanjut)) {
        return {
          kunci: `tv-${id}-${musimDiputar}-${lanjut.nomor}`,
          label: `Musim ${musimDiputar} · Episode ${lanjut.nomor}${lanjut.judul ? ` — ${lanjut.judul}` : ""}`,
          jalankan: () => pilihEpisode(musimDiputar, lanjut.nomor, true),
        };
      }
      if (!lanjut) {
        const musimLain = ((detail as DetailSeries | undefined)?.musim ?? [])
          .filter((m) => m.nomor > musimDiputar)
          .sort((a, b) => a.nomor - b.nomor)[0];
        if (musimLain) {
          return {
            kunci: `tv-${id}-${musimLain.nomor}-1`,
            label: `Musim ${musimLain.nomor} · Episode 1`,
            jalankan: () => pilihEpisode(musimLain.nomor, 1, true),
          };
        }
      }
      return null;
    }
    const sudah = new Set(bacaDiputar());
    const calon = (rekomendasiQ.data ?? []).find((f) => !sudah.has(`movie-${f.id}`) && f.id !== id);
    if (!calon) return null;
    return {
      kunci: `movie-${calon.id}`,
      label: calon.judul,
      jalankan: () => {
        setOtomatis(true);
        navigate({
          to: "/nonton/$id",
          params: { id: String(calon.id) },
          search: { jenis: "movie", ...(serverUrl !== undefined ? { server: serverUrl } : {}) },
        });
      },
    };
    // `selesai` ikut agar daftar "sudah diputar" dibaca ulang saat tontonan selesai.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTv, episodeQ.data, episodeDiputar, musimDiputar, detail, rekomendasiQ.data, id, pilihEpisode, navigate, serverUrl, selesai]);

  const berikutnyaRef = useRef<Berikutnya | null>(null);
  berikutnyaRef.current = berikutnya;
  const kunciBerikutnya = berikutnya?.kunci ?? null;

  // Hitung mundur autoplay setelah tontonan selesai.
  useEffect(() => {
    if (!selesai || !pengaturan.autoplay || !kunciBerikutnya || dibatalkan) {
      setHitung(null);
      return undefined;
    }
    setHitung(JEDA_AUTOPLAY_DETIK);
    const jam = setInterval(() => setHitung((h) => (h === null ? null : h - 1)), 1000);
    return () => clearInterval(jam);
  }, [selesai, pengaturan.autoplay, kunciBerikutnya, dibatalkan]);

  useEffect(() => {
    if (hitung !== null && hitung <= 0) {
      setHitung(null);
      berikutnyaRef.current?.jalankan();
    }
  }, [hitung]);

  if (!detail) {
    return (
      <main className="mx-auto w-full min-w-0 max-w-5xl px-4 pb-16">
        <p className="mt-10 text-sm text-muted-foreground">Memuat…</p>
      </main>
    );
  }

  const blokirIklan = pengaturan.blokirIklan;

  return (
    <main className="mx-auto w-full min-w-0 max-w-5xl px-4 pb-16">
      <Link
        to="/"
        search={isTv ? { jenis: "tv" } : {}}
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

      {/* Pemutar: tepi ke tepi di HP, tanpa celah di bawah iframe */}
      <div
        ref={pemutarRef}
        className="relative -mx-4 mt-3 overflow-hidden bg-black shadow-layar sm:mx-0 sm:rounded-xl sm:border sm:border-border/60"
      >
        <div className={layarPenuh ? "relative h-full w-full" : "relative aspect-video w-full"}>
          <iframe
            key={`${server.nama}-${id}-${isTv}-${musimSumber}-${episodeSumber}-${blokirIklan}-${otomatis}`}
            src={alamat}
            title={`Pemutar ${server.nama} — ${detail.judul}`}
            className="absolute inset-0 block size-full border-0"
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
          {hitung !== null && berikutnya && (
            <div className="absolute inset-x-0 bottom-0 flex justify-center p-3">
              <div className="w-full max-w-md rounded-xl border border-border/60 bg-background/95 p-3 shadow-layar backdrop-blur">
                <p className="text-xs text-muted-foreground">Berikutnya dalam {hitung} detik</p>
                <p className="mt-0.5 line-clamp-2 break-words text-sm font-medium text-foreground">
                  {berikutnya.label}
                </p>
                <div className="mt-2 flex gap-2">
                  <Button size="sm" onClick={() => berikutnya.jalankan()}>
                    <SkipForward className="size-4" />
                    Putar sekarang
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setDibatalkan(true)}>
                    <X className="size-4" />
                    Batal
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={toggleLayarPenuh}>
            {layarPenuh ? <Minimize className="size-4" /> : <Maximize className="size-4" />}
            {layarPenuh ? "Keluar layar penuh" : "Layar penuh"}
          </Button>
          {berikutnya && (
            <Button variant="outline" size="sm" onClick={() => berikutnya.jalankan()}>
              <SkipForward className="size-4" />
              {isTv ? "Episode berikutnya" : "Film berikutnya"}
            </Button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <label className="inline-flex cursor-pointer items-center gap-2 font-medium text-foreground">
            <input
              type="checkbox"
              checked={pengaturan.autoplay}
              onChange={(e) => ubahPengaturan({ autoplay: e.target.checked })}
              className="size-4 accent-primary"
            />
            Putar otomatis
          </label>
          <label className="inline-flex cursor-pointer items-center gap-2 font-medium text-foreground">
            <input
              type="checkbox"
              checked={blokirIklan}
              onChange={(e) => ubahPengaturan({ blokirIklan: e.target.checked })}
              className="size-4 accent-primary"
            />
            Blokir iklan & pop-up
          </label>
        </div>
      </div>
      <p className="mt-2 break-words text-xs text-muted-foreground">
        Tidak muncul atau error? Pindah server dulu. Kalau server tetap menolak, matikan blokir iklan
        sebentar.
      </p>

      {/* Info judul */}
      <section className="mt-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="judul-bagian break-words text-3xl leading-none text-foreground sm:text-4xl">
              {detail.judul}
            </h1>
            <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Star className="size-4 fill-primary text-primary" />
                {(detail.rating ?? 0).toFixed(1)}
              </span>
              {!!detail.rilis && <span>{detail.rilis.slice(0, 4)}</span>}
              {isTv && (
                <span className="rounded-full border border-border bg-card px-2 py-0.5 text-xs">
                  Series · S{musimDiputar} E{episodeDiputar}
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

        {detail.genres?.length ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {detail.genres.map((g) => (
              <Badge key={g.id} variant="secondary">
                {g.nama}
              </Badge>
            ))}
          </div>
        ) : null}

        {detail.sinopsis && (
          <p className="mt-4 max-w-3xl break-words text-sm leading-relaxed text-muted-foreground">
            {detail.sinopsis}
          </p>
        )}
      </section>

      {/* Daftar episode untuk series */}
      {isTv && (
        <Suspense fallback={<p className="mt-10 text-sm text-muted-foreground">Memuat daftar episode…</p>}>
          <DaftarEpisode
            id={id}
            musim={musim}
            musimDiputar={musimDiputar}
            episodeDiputar={episodeDiputar}
            musimTersedia={(detail as DetailSeries).musim.map((m) => ({ nomor: m.nomor, nama: m.nama }))}
            onPilih={(m, e) => pilihEpisode(m, e)}
            onGantiMusim={(m) => setMusim(m)}
          />
        </Suspense>
      )}

      {/* Rekomendasi selanjutnya */}
      <Suspense fallback={null}>
        <BarisRekomendasi jenis={jenisAktif} id={id} />
      </Suspense>
    </main>
  );
}
