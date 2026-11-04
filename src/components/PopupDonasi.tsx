import { useEffect, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { Heart } from "lucide-react";
import { toast } from "sonner";

import { NAMA_APLIKASI, TAUTAN_DONASI } from "@/lib/konfigurasi";
import {
  donasiSudahTampilHariIni,
  tandaiDonasiHariIni,
  ubahPengaturan,
  usePengaturan,
} from "@/lib/pengaturan";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Popup donasi: muncul paling banyak satu kali sehari, tidak muncul saat
 * pengguna sedang menonton, dan bisa dimatikan di About → Pengaturan.
 */
export function PopupDonasi() {
  const { popupDonasi } = usePengaturan();
  const [buka, setBuka] = useState(false);
  const sedangNonton = useRouterState({
    select: (s) => s.location.pathname.startsWith("/nonton"),
  });

  useEffect(() => {
    if (!popupDonasi || sedangNonton) return undefined;
    // Tanpa tautan donasi, popup hanya dipakai untuk uji coba di mode pengembangan.
    if (!TAUTAN_DONASI && !import.meta.env.DEV) return undefined;
    if (donasiSudahTampilHariIni()) return undefined;
    const waktu = setTimeout(() => {
      tandaiDonasiHariIni();
      setBuka(true);
    }, 4000);
    return () => clearTimeout(waktu);
  }, [popupDonasi, sedangNonton]);

  function matikan() {
    ubahPengaturan({ popupDonasi: false });
    setBuka(false);
    toast("Popup donasi dimatikan. Bisa dinyalakan lagi di About → Pengaturan.");
  }

  return (
    <Dialog open={buka} onOpenChange={setBuka}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <div className="mx-auto mb-1 flex size-12 items-center justify-center rounded-full bg-primary/15 text-primary">
            <Heart className="size-6 fill-current" />
          </div>
          <DialogTitle className="text-center">Dukung {NAMA_APLIKASI}</DialogTitle>
          <DialogDescription className="text-center">
            {NAMA_APLIKASI} gratis dipakai. Kalau terbantu, dukunganmu membantu biaya server dan
            pengembangan fitur baru. Berapa pun nilainya sangat berarti.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
          {TAUTAN_DONASI && (
            <Button asChild className="w-full">
              <a href={TAUTAN_DONASI} target="_blank" rel="noopener noreferrer">
                <Heart className="size-4" />
                Donasi sekarang
              </a>
            </Button>
          )}
          <Button variant="outline" className="w-full" onClick={() => setBuka(false)}>
            Nanti saja
          </Button>
          <button
            type="button"
            onClick={matikan}
            className="mt-1 text-center text-xs text-muted-foreground underline-offset-4 hover:underline"
          >
            Jangan tampilkan lagi
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
