import { Link } from "@tanstack/react-router";
import { Film as IkonFilm } from "lucide-react";

import type { Film, Jenis } from "@/lib/tmdb";

interface Props {
  film: Film;
  jenis: Jenis;
  /** Tampilkan lencana "Film"/"Series" (dipakai di hasil pencarian gabungan). */
  tampilkanJenis?: boolean;
}

/** Kartu poster film/series. Judul panjang turun ke baris berikutnya, tidak melebarkan halaman. */
export function KartuFilm({ film, jenis, tampilkanJenis = false }: Props) {
  const tahun = film.rilis ? film.rilis.slice(0, 4) : "";
  const lencana = jenis === "tv" ? "Series" : "Film";
  return (
    <Link
      to="/nonton/$id"
      params={{ id: String(film.id) }}
      search={{ jenis }}
      className="group muncul-lembut block min-w-0"
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
            <IkonFilm className="size-10" />
          </div>
        )}
        {film.rating > 0 && (
          <span className="absolute right-2 top-2 rounded-full bg-background/80 px-2 py-0.5 text-xs font-medium backdrop-blur">
            ★ {film.rating.toFixed(1)}
          </span>
        )}
        {(tampilkanJenis || jenis === "tv") && (
          <span className="absolute left-2 top-2 rounded-full bg-background/80 px-2 py-0.5 text-xs font-medium backdrop-blur">
            {lencana}
          </span>
        )}
      </div>
      <p className="mt-2 line-clamp-2 break-words text-sm font-medium leading-snug text-foreground">
        {film.judul}
      </p>
      {tahun && <p className="text-xs text-muted-foreground">{tahun}</p>}
    </Link>
  );
}
