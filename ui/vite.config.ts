import { defineConfig } from "vitest/config";

export default defineConfig({
  // shortcut: old chunks accumulate for open tabs; add version cleanup before release.
  build: { emptyOutDir: false },
  test: { environment: "jsdom", maxWorkers: 2 },
});
