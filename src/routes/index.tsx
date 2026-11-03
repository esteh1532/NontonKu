import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery, useQuery } from "@tanstack/react-query";
import { Film, Tv, SearchX, Play, History } from "lucide-react";
import { useState, type FormEvent } from "react";

import {
  opsiKatalog,
  opsiGenre,
  type Film as FilmItem,
  type Jenis,
} from "@/lib/tmdb";
import { daftarRiwayat } from "@/lib/koleksi";
import { useSesi } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const JUDUL = "NontonKu — Tonton Film & Series Langsung";
const DESKRIPSI =
  "Nonton film & series langsung dari browser — cari judul, pilih server, lanjutkan tontonanmu.";

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>) => {
    const hasil: { cari?: string; genre?: number; halaman?: number; jenis?: "tv" } = {};
    if (typeof search["cari"] === "string" && search["cari"].trim()) hasil.cari = search["cari"].trim();
    if (typeof search["genre"] === "number") hasil.genre = search["genre"];
    if (typeof search["halaman"] === "number" && search["halaman"] > 1) hasil.halaman = search["halaman"];
    if (search["jenis"] === "tv") hasil.jenis = "tv";
    return hasil;
  },
  loaderDeps: ({ search }) => ({
    jenis: search.jenis,
    cari: search.cari,
    genre: search.genre,
    halaman: search.halaman,
  }),
  loader: async ({ deps, context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(
        opsiKatalog(deps.jenis ?? "movie", deps.cari, deps.genre, deps.halaman ?? 1),
      ),
      context.queryClient.ensureQueryData(opsiGenre(deps.jenis ?? "movie")),
    ]);
  },
  component: HalamanUtama,
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

function KartuFilm({ film, jenis }: { film: FilmItem; jenis: Jenis }) {
  const tahun = film.rilis ? film.rilis.slice(0, 4) : "";
  return (
    <Link
      to="/nonton/$id"
      params={{ id: String(film.id) }}
      search={{ jenis }}
      className="group block muncul-lembut"
    >
      <div className="relative overflow-hidden rounded-xl bg-card shadow-layar">
        {film.poster ? (
          <img
            src={film.poster}
            alt={`Poster ${film.judul}`}
            loading="lazy"
            className="aspect-[2/3] w-full object-cover transition duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex aspect-[2/3] w-full items-center justify-center text-muted-foreground">
            <Film className="size-10" />
          </div>
        )}
        {film.rating > 0 && (
          <span className="absolute right-2 top-2 rounded-full bg-background/80 px-2 py-0.5 text-xs font-medium backdrop-blur">
            ★ {film.rating.toFixed(1)}
          </span>
        )}
        {jenis === "tv" && (
          <span className="absolute left-2 top-2 rounded-full bg-background/80 px-2 py-0.5 text-xs font-medium backdrop-blur">
            Series
          </span>
        )}
      </div>
      <p className="mt-2 truncate text-sm font-medium text-foreground">{film.judul}</p>
      <p className="text-xs text-muted-foreground">{tahun}</p>
    </Link>
  );
}

function Hero({ film }: { film: FilmItem }) {
  return (
    <section className="relative mt-4 overflow-hidden rounded-2xl shadow-layar">
      <div className="relative aspect-[16/10] w-full sm:aspect-[21/8]">
        {film.latar ? (
          <img
            src={film.latar}
            alt={`Latar film ${film.judul}`}
            className="absolute inset-0 size-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 size-full bg-card" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-4 sm:p-8">
          <p className="text-xs font-medium uppercase tracking-widest text-primary">
            Sedang populer minggu ini
          </p>
          <h1 className="judul-bagian mt-1 text-4xl leading-none text-foreground sm:text-6xl">
            {film.judul}
          </h1>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
            ★ {film.rating.toFixed(1)}
            {film.rilis && <span>· {film.rilis.slice(0, 4)}</span>}
          </p>
          {film.sinopsis && (
            <p className="mt-2 line-clamp-3 max-w-xl text-sm text-muted-foreground">{film.sinopsis}</p>
          )}
          <Button asChild size="lg" className="mt-4 rounded-full font-semibold">
            <Link to="/nonton/$id" params={{ id: String(film.id) }} search={{ jenis: "movie" }}>
              <Play className="size-5 fill-current" />
              Tonton sekarang
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

function LanjutTonton({ aktif }: { aktif: boolean }) {
  const riwayat = useQuery({
    queryKey: ["riwayat"],
    queryFn: () => daftarRiwayat(),
    enabled: aktif,
  });
  if (!aktif || !riwayat.data?.length) return null;
  return (
    <section className="mt-6">
      <h2 className="judul-bagian flex items-center gap-2 text-xl text-foreground">
        <History className="size-4 text-primary" />
        Lanjut tonton
      </h2>
      <div className="baris-gulir mt-3 flex gap-3 overflow-x-auto pb-2">
        {riwayat.data.map((item) => (
          <Link
            key={`${item.media_type}-${item.tmdb_id}`}
            to="/nonton/$id"
            params={{ id: String(item.tmdb_id) }}
            search={{
              jenis: item.media_type,
              ...(item.season_number ? { s: item.season_number } : {}),
              ...(item.episode_number ? { e: item.episode_number } : {}),
            }}
            className="w-24 shrink-0 sm:w-28"
          >
            {item.poster_path ? (
              <img
                src={`https://image.tmdb.org/t/p/w500${item.poster_path}`}
                alt={`Poster ${item.title}`}
                loading="lazy"
                className="aspect-[2/3] w-full rounded-lg object-cover"
              />
            ) : (
              <div className="aspect-[2/3] w-full rounded-lg bg-card" />
            )}
            <p className="mt-1 truncate text-xs text-muted-foreground">{item.title}</p>
            {item.media_type === "tv" && item.episode_number && (
              <p className="truncate text-[11px] text-primary/80">
                E{item.episode_number}
                {item.season_number ? ` · S${item.season_number}` : ""}
              </p>
            )}
          </Link>
        ))}
      </div>
    </section>
  );
}

function HalamanUtama() {
  const { cari, genre, halaman = 1, jenis } = Route.useSearch();
  const jenisAktif: Jenis = jenis ?? "movie";
  const { sesi } = useSesi();
  const navigate = useNavigate();
  const [kata, setKata] = useState("");

  const katalog = useSuspenseQuery(opsiKatalog(jenisAktif, cari, genre, halaman));
  const genreList = useSuspenseQuery(opsiGenre(jenisAktif));
  const hasil = katalog.data;
  const hero = !cari && !genre && jenisAktif === "movie" && hasil.length > 0 ? hasil[0] : null;
  const judulBagian = cari
    ? `Hasil pencarian "${cari}"`
    : genre
      ? (genreList.data.find((g) => g.id === genre)?.nama ?? (jenisAktif === "tv" ? "Series" : "Film"))
      : jenisAktif === "tv"
        ? "Series populer"
        : "Sedang populer";

  function carianBeranda(
    dengan: { genre?: number; halaman?: number; tanpaGenre?: boolean } = {},
  ): { cari?: string; genre?: number; halaman?: number; jenis?: "tv" } {
    const hasil: { cari?: string; genre?: number; halaman?: number; jenis?: "tv" } = {};
    if (cari) hasil.cari = cari;
    if (jenisAktif === "tv") hasil.jenis = "tv";
    if (!dengan.tanpaGenre && genre) hasil.genre = genre;
    if (dengan.genre) hasil.genre = dengan.genre;
    if (dengan.halaman && dengan.halaman > 1) hasil.halaman = dengan.halaman;
    return hasil;
  }

  async function kirimCari(e: FormEvent) {
    e.preventDefault();
    const q = kata.trim();
    if (q) await navigate({ to: "/", search: { cari: q } });
  }

  return (
    <main className="mx-auto w-full min-w-0 max-w-6xl px-4 pb-16">
      {hero && <Hero film={hero} />}

      <LanjutTonton aktif={!!sesi} />

      <section className="mt-8">
        <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 sm:flex sm:justify-between">
          <h2 className="judul-bagian min-w-0 truncate text-2xl text-foreground">{judulBagian}</h2>
          <div className="flex shrink-0 items-center gap-1 rounded-full bg-muted p-1">
            <Link
              to="/"
              search={carianBeranda({ tanpaGenre: true })}
              className={`rounded-full px-3 py-1 text-sm font-medium capitalize transition-colors ${
                jenisAktif === "movie"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground"
              }`}
            >
              <span className="flex items-center gap-1">
                <Film className="size-3.5" />
                Film
              </span>
            </Link>
            <Link
              to="/"
              search={{ ...carianBeranda({ tanpaGenre: true }), jenis: "tv" }}
              className={`rounded-full px-3 py-1 text-sm font-medium capitalize transition-colors ${
                jenisAktif === "tv" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              <span className="flex items-center gap-1">
                <Tv className="size-3.5" />
                Series
              </span>
            </Link>
          </div>
        </div>

        <div className="baris-gulir mt-3 flex gap-2 overflow-x-auto pb-2">
          <Button
            asChild
            variant={genre ? "outline" : "secondary"}
            size="sm"
            className="shrink-0 rounded-full"
          >
            <Link
              to="/"
              search={carianBeranda({ tanpaGenre: true })}
            >
              Populer
            </Link>
          </Button>
          {genreList.data.map((g) => (
            <Button
              key={g.id}
              asChild
              variant={genre === g.id ? "secondary" : "outline"}
              size="sm"
              className="shrink-0 rounded-full"
            >
              <Link
                to="/"
                search={carianBeranda({ genre: g.id })}
              >
                {g.nama}
              </Link>
            </Button>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {hasil.map((film) => (
            <KartuFilm key={film.id} film={film} jenis={jenisAktif} />
          ))}
        </div>

        {hasil.length === 0 && (
          <div className="mt-10 flex flex-col items-center gap-3 text-center text-muted-foreground">
            <SearchX className="size-10" />
            <p>Tidak ada hasil yang cocok. Coba kata kunci atau genre lain.</p>
          </div>
        )}

        {(halaman > 1 || hasil.length >= 20) && (
          <div className="mt-8 flex items-center justify-center gap-4">
            {halaman > 1 && (
              <Button asChild variant="outline" size="sm">
                <Link to="/" search={carianBeranda({ halaman: halaman - 1 })}>
                  Sebelumnya
                </Link>
              </Button>
            )}
            <span className="text-sm text-muted-foreground">Halaman {halaman}</span>
            <Button asChild variant="outline" size="sm">
              <Link to="/" search={carianBeranda({ halaman: halaman + 1 })}>
                Berikutnya
              </Link>
            </Button>
          </div>
        )}
      </section>

      {/* Form pencarian kecil juga tersedia di bawah untuk pengguna HP */}
      <form onSubmit={kirimCari} className="mt-10 sm:hidden">
        <Input
          value={kata}
          onChange={(e) => setKata(e.target.value)}
          placeholder="Cari judul lain…"
          className="rounded-full bg-card"
          aria-label="Cari film atau series"
        />
      </form>
    </main>
  );
}
