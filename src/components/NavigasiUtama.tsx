import { Link } from "@tanstack/react-router";
import { Clapperboard, House, Info, LogIn, Search } from "lucide-react";

import { NAMA_APLIKASI } from "@/lib/konfigurasi";
import { useSesi } from "@/lib/auth";

interface ItemNav {
  to: "/" | "/cari" | "/about" | "/auth";
  label: string;
  ikon: typeof House;
  persis?: boolean;
}

/**
 * Navigasi utama: Beranda, Pencarian, dan About.
 * Pengunjung yang belum masuk mendapat tombol Masuk; akun, riwayat, daftar
 * tersimpan, dan pengaturan ada di halaman About setelah login.
 */
function useItemNav(): ItemNav[] {
  const { sesi, memuat } = useSesi();
  const dasar: ItemNav[] = [
    { to: "/", label: "Beranda", ikon: House, persis: true },
    { to: "/cari", label: "Pencarian", ikon: Search },
    { to: "/about", label: "About", ikon: Info },
  ];
  if (!memuat && !sesi) dasar.push({ to: "/auth", label: "Masuk", ikon: LogIn });
  return dasar;
}

const kelasAktif = "bg-primary/15 text-primary";
const kelasNonaktif = "text-muted-foreground hover:text-foreground";

export function BilahAtas() {
  const item = useItemNav();
  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-4">
        <Link to="/" className="flex min-w-0 shrink-0 items-center gap-2">
          <Clapperboard className="size-5 text-primary" />
          <span className="judul-bagian text-2xl leading-none text-foreground">{NAMA_APLIKASI}</span>
        </Link>
        <nav aria-label="Navigasi utama" className="hidden items-center gap-1 md:flex">
          {item.map(({ to, label, ikon: Ikon, persis }) => (
            <Link
              key={to}
              to={to}
              activeOptions={{ exact: !!persis }}
              activeProps={{ className: kelasAktif, "aria-current": "page" }}
              inactiveProps={{ className: kelasNonaktif }}
              className="flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-colors"
            >
              <Ikon className="size-4" />
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}

/** Bilah navigasi bawah khusus layar kecil (HP). */
export function BilahBawah() {
  const item = useItemNav();
  return (
    <nav
      aria-label="Navigasi utama"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border/60 bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <ul className="mx-auto grid max-w-md" style={{ gridTemplateColumns: `repeat(${item.length}, minmax(0, 1fr))` }}>
        {item.map(({ to, label, ikon: Ikon, persis }) => (
          <li key={to} className="min-w-0">
            <Link
              to={to}
              activeOptions={{ exact: !!persis }}
              activeProps={{ className: "text-primary", "aria-current": "page" }}
              inactiveProps={{ className: "text-muted-foreground" }}
              className="flex flex-col items-center gap-0.5 px-1 py-2 text-[11px] font-medium transition-colors"
            >
              <Ikon className="size-5" />
              <span className="max-w-full truncate">{label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
