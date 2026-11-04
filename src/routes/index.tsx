import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, useQuery } from "@tanstack/react-query";
import { Film, Tv, SearchX, Play, History, ChevronLeft, ChevronRight } from "lucide-react";

import { opsiKatalog, opsiGenre, type Film as FilmItem, type Jenis } from "@/lib/tmdb";
import { daftarRiwayat } from "@/lib/koleksi";
import { useSesi } from "@/lib/auth";
import { KartuFilm } from "@/components/KartuFilm";
import { Button } from "@/components/ui/button";

const JUDUL = "NontonKu — Tonton Film & Series Langsung";
const DESKRIPSI =
  "Nonton film & series langsung dari browser — cari judul, pilih server, lanjutkan tontonanmu.";

type CarianBeranda = { genre?: number; halaman?: number; jenis?: "tv" };

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>): CarianBeranda => {
    const hasil: CarianBeranda = {};
    const genre = Number(search["genre"]);
    const halaman = Number(search["halaman"]);
    if (Number.isInteger(genre) && genre > 0) hasil.genre = genre;
    if (Number.isInteger(halaman) && halaman > 1) hasil.halaman = Math.min(halaman, 500);
    if (search["jenis"] === "tv") hasil.jenis = "tv";
    return hasil;
  },
  loaderDeps: ({ search }) => ({
    jenis: search.jenis,
    genre: search.genre,
    halaman: search.halaman,
  }),
  loader: async ({ deps, context }) => {
    const jenis: Jenis = deps.jenis ?? "movie";
    await Promise.all([
      context.queryClient.ensureQueryData(opsiKatalog(jenis, deps.genre, deps.halaman ?? 1)),
      context.queryClient.ensureQueryData(opsiGenre(jenis)),
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

function Hero({ film, jenis }: { film: FilmItem; jenis: Jenis }) {
  return (
    <section className="relative mt-4 overflow-hidden rounded-2xl shadow-layar">
      <div className="relative aspect-[16/10] w-full sm:aspect-[21/8]">
        {film.latar ? (
          <img
            src={film.latar}
            alt={`Latar ${film.judul}`}
            className="absolute inset-0 size-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 size-full bg-card" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 min-w-0 p-4 sm:p-8">
          <p className="text-xs font-medium uppercase tracking-widest text-primary">
            Sedang populer minggu ini
          </p>
          <h1 className="judul-bagian mt-1 line-clamp-2 break-words text-3xl leading-none text-foreground sm:text-6xl">
            {film.judul}
          </h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-sm text-muted-foreground">
            <span>★ {film.rating.toFixed(1)}</span>
            {film.rilis && <span>· {film.rilis.slice(0, 4)}</span>}
          </p>
          {film.sinopsis && (
            <p className="mt-2 line-clamp-3 max-w-xl break-words text-sm text-muted-foreground">
              {film.sinopsis}
            </p>
          )}
          <Button asChild size="lg" className="mt-4 rounded-full font-semibold">
            <Link to="/nonton/$id" params={{ id: String(film.id) }} search={{ jenis }}>
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
            <p className="mt-1 line-clamp-2 break-words text-xs text-muted-foreground">{item.title}</p>
            {item.media_type === "tv" && item.episode_number && (
              <p className="text-[11px] text-primary/80">
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
  const { genre, halaman = 1, jenis } = Route.useSearch();
  const jenisAktif: Jenis = jenis ?? "movie";
  const { sesi } = useSesi();

  const katalog = useSuspenseQuery(opsiKatalog(jenisAktif, genre, halaman));
  const genreList = useSuspenseQuery(opsiGenre(jenisAktif));
  const { hasil, totalHalaman } = katalog.data;
  const hero = !genre && halaman === 1 && hasil.length > 0 ? hasil[0] : null;
  const judulBagian = genre
    ? (genreList.data.find((g) => g.id === genre)?.nama ?? (jenisAktif === "tv" ? "Series" : "Film"))
    : jenisAktif === "tv"
      ? "Series populer"
      : "Film populer";

  // Pencarian URL dibuat eksplisit supaya pindah Film ↔ Series selalu bekerja
  // dua arah dan tidak membawa genre/halaman dari jenis sebelumnya.
  const cari = (dengan: CarianBeranda = {}): CarianBeranda => ({
    ...(jenisAktif === "tv" ? { jenis: "tv" as const } : {}),
    ...dengan,
  });
  const keHalaman = (n: number): CarianBeranda =>
    cari({ ...(genre ? { genre } : {}), ...(n > 1 ? { halaman: n } : {}) });

  const kelasTab = (aktif: boolean) =>
    `rounded-full px-3 py-1 text-sm font-medium transition-colors ${
      aktif ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
    }`;

  return (
    <main className="mx-auto w-full min-w-0 max-w-6xl px-4 pb-16">
      {hero && <Hero film={hero} jenis={jenisAktif} />}

      <LanjutTonton aktif={!!sesi} />

      <section className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="judul-bagian min-w-0 break-words text-2xl text-foreground">{judulBagian}</h2>
          <div className="flex shrink-0 items-center gap-1 rounded-full bg-muted p-1" role="tablist">
            <Link
              to="/"
              search={{}}
              role="tab"
              aria-selected={jenisAktif === "movie"}
              className={kelasTab(jenisAktif === "movie")}
            >
              <span className="flex items-center gap-1">
                <Film className="size-3.5" />
                Film
              </span>
            </Link>
            <Link
              to="/"
              search={{ jenis: "tv" }}
              role="tab"
              aria-selected={jenisAktif === "tv"}
              className={kelasTab(jenisAktif === "tv")}
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
            <Link to="/" search={cari()}>
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
              <Link to="/" search={cari({ genre: g.id })}>
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
            <p>Belum ada hasil untuk pilihan ini. Coba genre lain.</p>
          </div>
        )}

        {totalHalaman > 1 && (
          <div className="mt-8 flex items-center justify-center gap-3">
            {halaman > 1 ? (
              <Button asChild variant="outline" size="sm">
                <Link to="/" search={keHalaman(halaman - 1)}>
                  <ChevronLeft className="size-4" />
                  Sebelumnya
                </Link>
              </Button>
            ) : (
              <Button variant="outline" size="sm" disabled>
                <ChevronLeft className="size-4" />
                Sebelumnya
              </Button>
            )}
            <span className="text-sm text-muted-foreground">
              {halaman} / {totalHalaman}
            </span>
            {halaman < totalHalaman ? (
              <Button asChild variant="outline" size="sm">
                <Link to="/" search={keHalaman(halaman + 1)}>
                  Berikutnya
                  <ChevronRight className="size-4" />
                </Link>
              </Button>
            ) : (
              <Button variant="outline" size="sm" disabled>
                Berikutnya
                <ChevronRight className="size-4" />
              </Button>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
