import { QueryClient } from "@tanstack/react-query";
import { createRouter, rootRouteId } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";

import { routeTree } from "@/routeTree.gen";

// Cocokkan rute tanpa menjalankan loader atau merender: loader butuh server/jaringan,
// dan jsdom tidak memuat stylesheet yang ditunggu React.
describe("Routing aplikasi", () => {
  const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });

  it.each(["/", "/cari", "/about", "/auth", "/nonton/603"])(
    "mengenali halaman %s dan tidak jatuh ke not found",
    (jalur) => {
      const cocok = router.matchRoutes(jalur);
      expect(cocok.at(-1)?.routeId).not.toBe(rootRouteId);
    },
  );
});
