import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

try {
  const bytes = readFileSync(new URL("../data/catalog.json", import.meta.url));
  const catalog = JSON.parse(bytes.toString("utf8"));
  const provenance = JSON.parse(
    readFileSync(
      new URL("../data/catalog-provenance.json", import.meta.url),
      "utf8",
    ),
  );
  assert.equal(
    createHash("sha256").update(bytes).digest("hex"),
    provenance.catalog_sha256,
  );
  const categories = catalog.subjects.flatMap((subject) => subject.categories);
  const formulas = categories.flatMap((category) => category.formulas);
  const ids = [
    ...catalog.subjects.map((subject) => subject.id),
    ...categories.map((category) => category.id),
    ...formulas.map((formula) => formula.id),
  ];
  assert.deepEqual(
    {
      subjects: catalog.subjects.length,
      categories: categories.length,
      formulas: formulas.length,
      unique_ids: new Set(ids).size,
    },
    provenance.counts,
  );
  assert.equal(provenance.labels_and_latex_match_saved_source, true);
  assert.equal(
    formulas.filter((formula) => formula.body.type === "fragment").length,
    1,
  );
  assert.ok(
    formulas
      .find((formula) => formula.id === "formula-unit-circle-01-001")
      .body.latex.includes("\\begin{tabular}"),
  );
  console.log(
    "Catalog digest, counts, ID uniqueness, and the unit-circle fragment passed.",
  );
} catch (error) {
  console.error(
    "Catalog verification failed:",
    error instanceof Error ? error.message : error,
  );
  process.exitCode = 1;
}
