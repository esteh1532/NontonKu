/**
 * Akun: ID + kata sandi, tanpa email.
 *
 * ID pengguna dipetakan ke alamat email internal `id@akun.nontonku.lokal`
 * milik layanan backend, jadi pengguna hanya perlu mengingat ID dan sandi.
 */
import { useEffect, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export interface Sesi {
  idAkun: string;
  idPengguna: string;
}

const AKHIRAN_EMAIL = "@akun.nontonku.lokal";
export const ID_POLA = /^[a-z0-9._]{3,24}$/;
export const ID_PESAN = "ID harus 3–24 karakter: huruf kecil, angka, titik, atau garis bawah.";
export const SANDI_PESAN = "Kata sandi minimal 8 karakter, campuran huruf dan angka lebih aman.";

export interface HasilAuth {
  sukses: boolean;
  pesan: string;
}

function emailDariId(id: string) {
  return `${id}${AKHIRAN_EMAIL}`;
}

export function idValid(id: string) {
  return ID_POLA.test(id);
}

export function sandiValid(sandi: string) {
  return sandi.length >= 8;
}

/** Cek apakah sebuah ID belum dipakai pengguna lain. */
export async function cekIdTersedia(id: string): Promise<boolean> {
  if (!ID_POLA.test(id)) return false;
  const { data } = await supabase.from("profiles").select("id").eq("username", id).maybeSingle();
  return !data;
}

function pesanKesalahan(pesan: string): string {
  if (pesan.includes("Invalid login credentials")) return "ID atau kata sandi salah.";
  if (pesan.includes("already registered")) return "ID ini sudah terdaftar. Coba masuk saja.";
  if (pesan.includes("at least 6 characters")) return "Kata sandi minimal 8 karakter.";
  if (pesan.includes("weak") || pesan.includes("easy to guess"))
    return "Kata sandi terlalu mudah ditebak. Pakai minimal 8 karakter, gabungan huruf besar, huruf kecil, dan angka.";
  return "Terjadi kesalahan. Coba lagi sebentar.";
}

/** Buat akun baru dari ID + kata sandi. */
export async function daftar(id: string, sandi: string): Promise<HasilAuth> {
  const bersih = id.trim().toLowerCase();
  if (!idValid(bersih)) return { sukses: false, pesan: ID_PESAN };
  if (!sandiValid(sandi)) return { sukses: false, pesan: SANDI_PESAN };
  const { error } = await supabase.auth.signUp({
    email: emailDariId(bersih),
    password: sandi,
    options: { data: { username: bersih } },
  });
  if (error) return { sukses: false, pesan: pesanKesalahan(error.message) };
  return { sukses: true, pesan: "" };
}

/** Masuk dengan ID + kata sandi. */
export async function masuk(id: string, sandi: string): Promise<HasilAuth> {
  const bersih = id.trim().toLowerCase();
  if (!idValid(bersih)) return { sukses: false, pesan: ID_PESAN };
  const { error } = await supabase.auth.signInWithPassword({
    email: emailDariId(bersih),
    password: sandi,
  });
  if (error) return { sukses: false, pesan: pesanKesalahan(error.message) };
  return { sukses: true, pesan: "" };
}

/** Keluar dari akun. */
export async function keluar() {
  await supabase.auth.signOut();
}

function ubahKeSesi(user: { id: string; user_metadata?: Record<string, unknown> } | null): Sesi | null {
  if (!user) return null;
  return {
    idAkun: user.id,
    idPengguna: (user.user_metadata?.["username"] as string) ?? "",
  };
}

/** Hook sesi: siapa yang sedang masuk, dipakai di bilah atas dan halaman. */
export function useSesi() {
  const [sesi, setSesi] = useState<Sesi | null>(null);
  const [memuat, setMemuat] = useState(true);
  const router = useRouter();
  const kueri = useQueryClient();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSesi(ubahKeSesi(data.session?.user ?? null));
      setMemuat(false);
    });
    const langganan = supabase.auth.onAuthStateChange((peristiwa, sesiBaru) => {
      setSesi(ubahKeSesi(sesiBaru?.user ?? null));
      if (peristiwa !== "SIGNED_IN" && peristiwa !== "SIGNED_OUT" && peristiwa !== "USER_UPDATED") return;
      router.invalidate();
      if (peristiwa === "SIGNED_OUT") kueri.clear();
      else kueri.invalidateQueries();
    });
    return () => langganan.data.subscription.unsubscribe();
  }, [router, kueri]);

  return { sesi, memuat };
}
