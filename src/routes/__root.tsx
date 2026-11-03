import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useNavigate,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode, type FormEvent } from "react";
import { Search, LogOut, User, Clapperboard } from "lucide-react";
import { toast } from "sonner";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { useSesi, keluar } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Toaster } from "@/components/ui/sonner";

const NAMA_APLIKASI = "NontonKu";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Halaman tidak ditemukan</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Halaman yang dicari tidak ada atau sudah dipindah.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Kembali ke beranda
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Halaman ini gagal dimuat
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Ada masalah di sisi kami. Coba muat ulang atau kembali ke beranda.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Coba lagi
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Ke beranda
          </a>
        </div>
      </div>
    </div>
  );
}

function BilahAtas() {
  const { sesi, memuat } = useSesi();
  const navigate = useNavigate();
  const [kata, setKata] = useState("");

  async function cari(e: FormEvent) {
    e.preventDefault();
    const q = kata.trim();
    if (q) await navigate({ to: "/", search: { cari: q } });
  }

  async function keluarAkun() {
    await keluar();
    toast("Sampai jumpa lagi!");
    await navigate({ to: "/auth", replace: true });
  }

  return (
    <header className="sticky top-0 z-50 min-w-0 border-b border-border/60 bg-background/85 backdrop-blur">
      <div className="mx-auto grid h-14 max-w-6xl grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 px-4 sm:flex sm:gap-4">
        <Link to="/" className="flex shrink-0 items-center gap-2">
          <Clapperboard className="size-5 text-primary" />
          <span className="judul-bagian hidden text-2xl leading-none text-foreground sm:block">
            {NAMA_APLIKASI}
          </span>
        </Link>
        <form onSubmit={cari} className="relative min-w-0 sm:ml-4 sm:w-72 sm:flex-none">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={kata}
            onChange={(e) => setKata(e.target.value)}
            placeholder="Cari film atau series…"
            className="h-9 rounded-full bg-card pl-9"
            aria-label="Cari film atau series"
          />
        </form>
        <div className="flex shrink-0 items-center gap-1.5">
          {memuat ? (
            <div className="size-8 animate-pulse rounded-full bg-muted" aria-hidden="true" />
          ) : sesi ? (
            <>
              <Button asChild variant="ghost" size="sm" className="max-w-28 sm:max-w-40">
                <Link to="/akun">
                  <User className="size-4" />
                  <span className="truncate">{sesi.idPengguna || "Tontonan"}</span>
                </Link>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={keluarAkun}
                aria-label="Keluar dari akun"
                title="Keluar"
              >
                <LogOut className="size-4" />
              </Button>
            </>
          ) : (
            <Button asChild size="sm" className="rounded-full">
              <Link to="/auth">Masuk</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: NAMA_APLIKASI },
      {
        name: "description",
        content: "Nonton film & series langsung dari browser — cari judul, pilih server, tonton.",
      },
      { name: "theme-color", content: "#0b0d14" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: NAMA_APLIKASI },
      { property: "og:title", content: NAMA_APLIKASI },
      {
        property: "og:description",
        content: "Nonton film & series langsung dari browser — cari judul, pilih server, tonton.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Barlow:wght@400;500;600;700&display=swap",
      },
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/png", href: "/favicon.png" },
      { rel: "apple-touch-icon", href: "/icons/apple-touch-icon.png" },
      { rel: "manifest", href: "/manifest.webmanifest" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="id" className="dark">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <div className="flex min-h-screen flex-col bg-background">
        <BilahAtas />
        {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
        <Outlet />
        <footer className="border-t border-border/60 py-6 text-center text-xs text-muted-foreground">
          {NAMA_APLIKASI} · film & series dari TMDB
        </footer>
        <Toaster position="top-center" />
      </div>
    </QueryClientProvider>
  );
}
