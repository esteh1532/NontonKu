// Konfigurasi build: paket di bawah sudah menyertakan plugin TanStack Start, React, Tailwind,
// tsconfig paths, Nitro, alias "@", dan injeksi variabel VITE_*. Jangan menambahkannya lagi
// secara manual agar plugin tidak terpasang ganda.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    // Arahkan entri server ke src/server.ts (pembungkus error SSR).
    server: { entry: "server" },
  },
});
