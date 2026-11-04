import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ChevronLeft, ChevronRight, LoaderCircle, Search, SearchX, X } from "lucide-react";

import { opsiCari } from "@/lib/tmdb";
import { KartuFilm } from "@/components/KartuFilm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const JUDUL = "Pencarian — NontonKu";
const DESKRIPSI = "Cari film dan series berdasarkan judul sekaligus, tanpa pindah halaman.";

type CarianHalaman = { q?: string; halaman?: number };

export const Route = createFileRoute("/cari")({
  validateSearch: (search: Record<string, unknown>): CarianHalaman => {
    const hasil: CarianHalaman = {};
    if (typeof search["q"] === "string" && search["q"].trim()) hasil.q = search["q"].trim().slice(0, 100);
    const halaman = Number(search["halaman"]);
    if (Number.isInteger(halaman) && halaman > 1) hasil.halaman = Math.min(halaman, 500);
    return hasil;
  },
  component: HalamanCari,
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

function HalamanCari() {
  const { q = "", halaman = 1 } = Route.useSearch();
  const navigate = useNavigate({ from: "/cari" });
  const [kata, setKata] = useState(q);
  const inputRef = useRef<HTMLInputElement>(null);

  // Ikuti perubahan URL (tombol back/forward, tautan dari tempat lain).
  useEffect(() => {
    setKata(q);
  }, [q]);

  // Cari otomatis setelah pengguna berhenti mengetik sebentar.
  useEffect(() => {
    const bersih = kata.trim();
    if (bersih === q) return undefined;
    const waktu = setTimeout(() => {
      navigate({ search: bersih ? { q: bersih } : {}, replace: true });
    }, 450);
    return () => clearTimeout(waktu);
  }, [kata, q, navigate]);

  useEffect(() => {
    if (!q) inputRef.current?.focus();
  }, [q]);

  const hasilQ = useQuery({
    ...opsiCari(q, halaman),
    enabled: q.length > 0,
    placeholderData: keepPreviousData,
  });

  function kirim(e: FormEvent) {
    e.preventDefault();
    const bersih = kata.trim();
    navigate({ search: bersih ? { q: bersih } : {}, replace: true });
  }

  const data = hasilQ.data;
  const ke = (n: number): CarianHalaman => ({ q, ...(n > 1 ? { halaman: n } : {}) });

  return (
    <main className="mx-auto w-full min-w-0 max-w-6xl px-4 pb-16">
      <h1 className="judul-bagian mt-6 text-3xl text-foreground">Pencarian</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Ketik judul film atau series. Hasilnya muncul bersama di satu halaman.
      </p>

      <form onSubmit={kirim} role="search" className="relative mt-4 max-w-xl">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={kata}
          onChange={(e) => setKata(e.target.value)}
          placeholder="Cari judul film atau series…"
          className="h-11 rounded-full bg-card pl-10 pr-10"
          aria-label="Cari judul film atau series"
          autoComplete="off"
          enterKeyHint="search"
        />
        {kata && (
          <button
            type="button"
            onClick={() => {
              setKata("");
              navigate({ search: {}, replace: true });
              inputRef.current?.focus();
            }}
            aria-label="Hapus kata kunci"
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        )}
      </form>

      {!q && (
        <div className="mt-16 flex flex-col items-center gap-3 text-center text-muted-foreground">
          <Search className="size-10" />
          <p>Mulai ketik untuk mencari film dan series.</p>
        </div>
      )}

      {q && (
        <section className="mt-6" aria-live="polite">
          <div className="flex min-w-0 items-center gap-2">
            <h2 className="judul-bagian min-w-0 break-words text-xl text-foreground">
              Hasil untuk “{q}”
            </h2>
            {hasilQ.isFetching && <LoaderCircle className="size-4 shrink-0 animate-spin text-primary" />}
          </div>

          {hasilQ.isError && (
            <div className="mt-8 flex flex-col items-center gap-3 text-center text-muted-foreground">
              <SearchX className="size-10" />
              <p>Pencarian gagal dimuat. Periksa koneksi lalu coba lagi.</p>
              <Button variant="outline" size="sm" onClick={() => hasilQ.refetch()}>
                Coba lagi
              </Button>
            </div>
          )}

          {data && data.hasil.length > 0 && (
            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {data.hasil.map((film) => (
                <KartuFilm
                  key={`${film.jenis}-${film.id}`}
                  film={film}
                  jenis={film.jenis ?? "movie"}
                  tampilkanJenis
                />
              ))}
            </div>
          )}

          {data && data.hasil.length === 0 && !hasilQ.isFetching && (
            <div className="mt-10 flex flex-col items-center gap-3 text-center text-muted-foreground">
              <SearchX className="size-10" />
              <p>Tidak ada film atau series dengan judul itu. Coba kata kunci lain.</p>
            </div>
          )}

          {data && data.totalHalaman > 1 && (
            <div className="mt-8 flex items-center justify-center gap-3">
              {halaman > 1 ? (
                <Button asChild variant="outline" size="sm">
                  <Link to="/cari" search={ke(halaman - 1)}>
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
                {halaman} / {data.totalHalaman}
              </span>
              {halaman < data.totalHalaman ? (
                <Button asChild variant="outline" size="sm">
                  <Link to="/cari" search={ke(halaman + 1)}>
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
      )}
    </main>
  );
}
