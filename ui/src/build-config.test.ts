import { expect, test } from "vitest";
import config from "../vite.config";

test("local builds retain assets needed by already-open PDF tabs", () => {
  expect(config).toMatchObject({ build: { emptyOutDir: false } });
});
