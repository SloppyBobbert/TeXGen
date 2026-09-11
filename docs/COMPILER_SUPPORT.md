# Compiler support

The compiler cache is generated and verified against a curated, sparse TeX corpus. It covers all catalog formulas, selected generated article/extarticle layouts, matrices/cases/tabular content, calculus, statistics, unit-circle content, practice problems, raw complete documents, and raw-fragment wrapping. The full layout Cartesian matrix is structural corpus metadata; the compiler cache uses a smaller covering set, not every combination.

The exact common raw package set is: `article`, `extarticle`, `geometry`, `amsmath`, `amssymb`, `enumitem`, `multicol`, `adjustbox`, `inputenc`, `mathtools`, `array`, `booktabs`, `xcolor`, and `hyperref`.

External files and images, bibliography processing, index processing, shell escape, network-dependent content, and unlisted packages are explicitly unsupported. Cache compatibility is corpus-based sparse cache support, not a guarantee that arbitrary LaTeX will compile.
