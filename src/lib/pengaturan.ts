/**
 * Pengaturan pengguna, disimpan di perangkat (localStorage) sehingga berlaku
 * untuk tamu maupun yang sudah masuk.
 */
import { useSyncExternalStore } from "react";

export interface Pengaturan {
  /** Putar otomatis episode/film berikutnya saat tontonan selesai. */
  autoplay: boolean;
  /** Indeks server pemutar yang dipakai pertama kali (0 = Server 1). */
  serverUtama: number;
  /** Blokir iklan & pop-up dari pemutar (memakai sandbox iframe). */
  blokirIklan: boolean;
  /** Tampilkan popup donasi satu kali sehari. */
  popupDonasi: boolean;
}

export const PENGATURAN_AWAL: Pengaturan = {
  autoplay: true,
  serverUtama: 0,
  blokirIklan: true,
  popupDonasi: true,
};

const KUNCI = "nontonku:pengaturan";
const KUNCI_DONASI = "nontonku:donasi-terakhir";

let cache: Pengaturan = PENGATURAN_AWAL;
let dimuat = false;
const pendengar = new Set<() => void>();

function baca(): Pengaturan {
  try {
    const mentah = localStorage.getItem(KUNCI);
    if (!mentah) return PENGATURAN_AWAL;
    const o = JSON.parse(mentah) as Partial<Pengaturan>;
    return {
      autoplay: typeof o.autoplay === "boolean" ? o.autoplay : PENGATURAN_AWAL.autoplay,
      serverUtama:
        typeof o.serverUtama === "number" && o.serverUtama >= 0 && o.serverUtama <= 2
          ? Math.trunc(o.serverUtama)
          : PENGATURAN_AWAL.serverUtama,
      blokirIklan: typeof o.blokirIklan === "boolean" ? o.blokirIklan : PENGATURAN_AWAL.blokirIklan,
      popupDonasi: typeof o.popupDonasi === "boolean" ? o.popupDonasi : PENGATURAN_AWAL.popupDonasi,
    };
  } catch {
    return PENGATURAN_AWAL;
  }
}

function umumkan() {
  for (const fn of pendengar) fn();
}

function muat() {
  if (dimuat || typeof window === "undefined") return;
  dimuat = true;
  cache = baca();
  // Sinkron antar tab.
  window.addEventListener("storage", (e) => {
    if (e.key === KUNCI) {
      cache = baca();
      umumkan();
    }
  });
}

export function ubahPengaturan(bagian: Partial<Pengaturan>) {
  muat();
  cache = { ...cache, ...bagian };
  try {
    localStorage.setItem(KUNCI, JSON.stringify(cache));
  } catch {
    /* penyimpanan penuh atau diblokir: pengaturan tetap berlaku selama tab terbuka */
  }
  umumkan();
}

export function resetPengaturan() {
  ubahPengaturan({ ...PENGATURAN_AWAL });
}

function langganan(fn: () => void) {
  muat();
  pendengar.add(fn);
  return () => {
    pendengar.delete(fn);
  };
}

export function usePengaturan(): Pengaturan {
  return useSyncExternalStore(
    langganan,
    () => {
      muat();
      return cache;
    },
    () => PENGATURAN_AWAL,
  );
}

/* ---------- Popup donasi: sekali sehari ---------- */

function hariIni(): string {
  const d = new Date();
  const dua = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${dua(d.getMonth() + 1)}-${dua(d.getDate())}`;
}

export function donasiSudahTampilHariIni(): boolean {
  try {
    return localStorage.getItem(KUNCI_DONASI) === hariIni();
  } catch {
    return true; // penyimpanan tidak bisa dipakai: jangan ganggu pengguna
  }
}

export function tandaiDonasiHariIni() {
  try {
    localStorage.setItem(KUNCI_DONASI, hariIni());
  } catch {
    /* abaikan */
  }
}
