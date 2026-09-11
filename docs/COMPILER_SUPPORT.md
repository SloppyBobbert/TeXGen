# Compiler support

The compiler cache is generated and verified against a curated, sparse TeX corpus. It covers all catalog formulas, selected generated article/extarticle layouts, matrices/cases/tabular content, calculus, statistics, unit-circle content, practice problems, raw complete documents, and raw-fragment wrapping. The full layout Cartesian matrix is structural corpus metadata; the compiler cache uses a smaller covering set, not every combination.

The exact common raw package set is: `article`, `extarticle`, `geometry`, `amsmath`, `amssymb`, `enumitem`, `multicol`, `adjustbox`, `inputenc`, `mathtools`, `array`, `booktabs`, `xcolor`, and `hyperref`.

External files and images, bibliography processing, index processing, shell escape, network-dependent content, and unlisted packages are explicitly unsupported. Cache compatibility is corpus-based sparse cache support, not a guarantee that arbitrary LaTeX will compile.

## Build prerequisite

The compiler image requires a verified asset tree at `backend/.compiler-assets` before the Docker build. A clean checkout does not contain these ignored files. Do not bypass verification or use an empty directory to make the build pass.

The current curated Tectonic binary is Linux ARM64. Use a matching ARM64 build and runtime. Do not use this binary on an x86-64 runner. The browser E2E job uses `ubuntu-24.04-arm` and stages the following release archive before starting Compose:

- [Compiler asset prerelease](https://github.com/SloppyBobbert/TeXGen/releases/tag/compiler-assets-0.15.0-238864f4e9df)
- File: `texgen-compiler-assets-0.15.0-corpus-238864f4e9df.tar.gz`
- SHA-256: `add28e26a3af62f800b8171070501bf1ecb4f5b0f79244c5f14b11023fe9bce3`
- Archive size: 25,255,835 bytes. Extracted file size: 82,783,135 bytes, including the deployment manifest.

Verify this checksum before extraction. Then run `python3 -S backend/compiler_sidecar/container/verify_assets.py backend/.compiler-assets`. CI performs both checks before the Docker build; the Dockerfile verifies the tree again. A missing archive, changed checksum, or invalid tree must fail the build. The archive and extracted assets remain outside Git.

## Manifest formats

Two inventories have different purposes:

- `cache_manifest.py` records a cache-only proof. Its `files` list includes relative paths, hashes, and sizes. The record also includes corpus, bundle, archive, and root-digest provenance. `verify_cache_manifest` verifies this format. It is not the image build manifest.
- `container/manifest.schema.json` defines the deployment manifest at `.compiler-assets/provenance/manifest.json`. It contains only a `files` object mapping each deployment-relative file path to its SHA-256 and size. It inventories the complete binary/cache/formats/provenance tree, except the manifest itself. `container/verify_assets.py` verifies this format and rejects missing, extra, or unsafe files.

To assemble a new deployment tree, first verify its cache-only proof. Copy the approved binary, cache, formats, and provenance into the final tree. Then calculate a deployment inventory from that complete tree using the deployment schema. Do not pass the cache-only manifest directly to the image verifier or convert only its `files` field: it omits deployment assets outside the cache. Verify the final tree before archiving it. Consumers of a verified release archive must preserve the included deployment manifest and verify the unpacked tree again.

## Health checks

The health check compiles a minimal document through the same socket as normal jobs. Its 40-second I/O budget covers one running 15-second job, its own job, and cleanup/framing time. Compose allows 45 seconds for the probe process. These probe budgets do not raise the 15-second limit on individual compiler jobs. Heavy load can still fill the bounded queue and cause a probe to fail; this check tests compilation readiness, not independent process liveness.
