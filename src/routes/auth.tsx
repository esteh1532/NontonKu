import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { LoaderCircle } from "lucide-react";

import {
  cekIdTersedia,
  daftar,
  masuk,
  useSesi,
  ID_PESAN,
} from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const JUDUL = "Masuk — NontonKu";
const DESKRIPSI = "Masuk ke NontonKu untuk menyimpan riwayat tonton dan film favorit.";

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>) => {
    const hasil: { lanjut?: string } = {};
    const nilai = search["lanjut"];
    if (typeof nilai === "string" && nilai.startsWith("/") && !nilai.startsWith("//")) {
      hasil.lanjut = nilai;
    }
    return hasil;
  },
  component: HalamanAuth,
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

function HalamanAuth() {
  const { lanjut } = Route.useSearch();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"masuk" | "daftar">("masuk");
  const [id, setId] = useState("");
  const [sandi, setSandi] = useState("");
  const [ulang, setUlang] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [pesanCek, setPesanCek] = useState("");
  const tujuan = lanjut ?? "/";
  const { sesi, memuat } = useSesi();

  // Sudah masuk? Tidak perlu melihat halaman login lagi.
  useEffect(() => {
    if (!memuat && sesi) navigate({ to: tujuan, replace: true });
  }, [memuat, sesi, navigate, tujuan]);

  function ke(t: string) {
    navigate({ to: t });
  }

  async function cekId(nilai: string) {
    if (!nilai.trim()) return;
    setSibuk(true);
    try {
      const tersedia = await cekIdTersedia(nilai.trim().toLowerCase());
      setPesanCek(tersedia ? "ID bisa dipakai." : "ID sudah dipakai, coba yang lain.");
    } catch {
      setPesanCek("");
    } finally {
      setSibuk(false);
    }
  }

  async function kirim(e: FormEvent) {
    e.preventDefault();
    setPesanCek("");
    setSibuk(true);
    try {
      if (mode === "daftar") {
        if (sandi !== ulang) {
          toast("Ulangi kata sandi belum sama.");
          return;
        }
        if (!(await cekIdTersedia(id.trim().toLowerCase()))) {
          toast("ID sudah dipakai, coba yang lain.");
          return;
        }
        const hasil = await daftar(id, sandi);
        if (!hasil.sukses) {
          toast(hasil.pesan);
          return;
        }
        toast(`Selamat datang, ${id.toLowerCase()}!`);
        ke(tujuan);
        return;
      }
      const hasil = await masuk(id, sandi);
      if (!hasil.sukses) {
        toast(hasil.pesan);
        return;
      }
      toast("Berhasil masuk.");
      ke(tujuan);
    } finally {
      setSibuk(false);
    }
  }

  return (
    <main className="flex min-w-0 flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm rounded-2xl border border-border/60 bg-card p-6 shadow-layar">
        <h1 className="judul-bagian text-3xl text-foreground">
          {mode === "masuk" ? "Masuk" : "Daftar akun"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {mode === "masuk"
            ? "Masuk untuk lanjut menonton dari riwayatmu."
            : "Buat akun untuk menyimpan riwayat tonton dan film favorit."}
        </p>
        <div className="mt-4 grid grid-cols-2 gap-1 rounded-full bg-muted p-1">
          {(["masuk", "daftar"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMode(m);
                setPesanCek("");
              }}
              className={`rounded-full py-1.5 text-sm font-medium capitalize transition-colors ${
                mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
        <form onSubmit={kirim} className="mt-5 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="id">ID</Label>
            <Input
              id="id"
              value={id}
              onChange={(e) => setId(e.target.value.toLowerCase())}
              onBlur={() => mode === "daftar" && cekId(id.trim().toLowerCase())}
              placeholder="contoh: budi_01"
              autoComplete="username"
              required
            />
            {pesanCek && <p className="text-xs text-muted-foreground">{pesanCek}</p>}
            {mode === "daftar" && !pesanCek && (
              <p className="text-xs text-muted-foreground">{ID_PESAN}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sandi">Kata sandi</Label>
            <Input
              id="sandi"
              type="password"
              value={sandi}
              onChange={(e) => setSandi(e.target.value)}
              placeholder={mode === "daftar" ? "minimal 8 karakter" : "kata sandi"}
              autoComplete={mode === "daftar" ? "new-password" : "current-password"}
              required
            />
            {mode === "daftar" && (
              <p className="text-xs text-muted-foreground">
                Kata sandi minimal 8 karakter, campuran huruf dan angka lebih aman.
              </p>
            )}
          </div>
          {mode === "daftar" && (
            <div className="space-y-1.5">
              <Label htmlFor="ulang">Ulangi kata sandi</Label>
              <Input
                id="ulang"
                type="password"
                value={ulang}
                onChange={(e) => setUlang(e.target.value)}
                autoComplete="new-password"
                required
              />
            </div>
          )}
          <Button type="submit" className="w-full" disabled={sibuk}>
            {sibuk && <LoaderCircle className="size-4 animate-spin" />}
            {mode === "masuk" ? "Masuk" : "Buat akun"}
          </Button>
        </form>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          Hanya ID dan kata sandi — tanpa email. Riwayat tonton dan film tersimpan tersambung ke
          akunmu di semua perangkat.
        </p>
      </div>
    </main>
  );
}
