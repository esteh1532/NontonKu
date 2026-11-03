import { createFileRoute, redirect, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { supabase } from "@/integrations/supabase/client";
import { useSesi } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async () => {
    // SSR/prerender has no browser session: render the shell and let the
    // client-side guard below (plus the auth-protected data calls) enforce access.
    if (typeof document === "undefined") return;
    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user) throw redirect({ to: "/auth" });
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { sesi, memuat } = useSesi();
  const navigate = useNavigate();

  useEffect(() => {
    if (!memuat && !sesi) navigate({ to: "/auth", replace: true });
  }, [memuat, sesi, navigate]);

  if (memuat) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm text-muted-foreground">Memuat…</p>
      </div>
    );
  }
  if (!sesi) return null;
  return <Outlet />;
}
