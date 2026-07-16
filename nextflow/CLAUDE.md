# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Purpose

The `nextflow/` module of the Samui repo: a Nextflow workflow that preprocesses
spatial data into the on-disk format consumed by the
[Samui browser](https://samuibrowser.com) — a web viewer for large multi-channel
images and their spatial features. It is the batch/headless counterpart to Samui's
interactive preprocessing GUI, and it drives the repo's own `loopy` package (the
readers live in `../loopy/spatial_io/`); it is not a standalone project.

## Layout

One entrypoint, `main.nf`, dispatches on `--format` (a platform, `auto`,
`spatialdata`, or `files`). The reader code lives in the repo's `loopy` package
(`../loopy/spatial_io/`) and is uv-installed into each task at runtime alongside the
rest of loopy (see "Runtime" below) — the workflow itself is only the `.nf` files.

- `main.nf` / `modules/preprocess.nf` — the workflow: one `PREPROCESS_SAMUI` process
  that stages the input(s) plus the package source (`pyproject.toml`, `README.md`,
  `loopy/`), installs per-format deps (`EXTRA_DEPS` in `modules/preprocess.nf`, via
  `uvInstall` in `modules/common.nf`), runs the installed `preprocess` CLI, and publishes
  the sample folder + `index.html`.
- `../loopy/spatial_io/preprocess.py` — the single CLI (`preprocess` console script,
  declared in `../pyproject.toml`): parses `--format`, dispatches to a reader, calls the builder.
- `../loopy/spatial_io/` — the readers. `common.py` holds the `SpatialSample`/`FeatureGroup`
  intermediate and the **shared** decoders (MEX, 10x `.h5`, `.h5ad`/`anndata_to_sample`,
  10x clustering, control-feature filtering); `build.py` drives loopy's `Sample`
  (`add_coords`/`add_chunked_feature`/`add_image`/`write`) — it does not re-implement the
  coordinate join or feature compression, and only preflight-checks id overlap
  (`_check_overlap`) since loopy's `join_idx` already left-joins. `__init__.py` has the
  registry + `detect_format` (auto). One module per format: `xenium`, `visium`,
  `visium_hd`, `cosmx`, `spatialdata`, `files`. **Add a platform by adding one module
  that returns a `SpatialSample`** — reuse `common.py`, don't re-implement matrix/cluster reading.
- `modules/site.nf` — always bundles the viewer: `BUILD_SAMUI` downloads a Samui release
  (`--samui_version`) and builds its static site in a node container (pnpm; runs as the
  host uid so pnpm installs to a per-task prefix); `ASSEMBLE_SITE` publishes the viewer
  at the outdir root with the data folder beside it and injects a bootstrap into the
  viewer's own `index.html` that points it (via `history.replaceState`, not a redirect,
  so refresh works) at the sibling sample. Site + data share one origin (no
  cross-origin/CORS/PNA/whitelist).
- `test/` — `make_synthetic_data.py` (tiny `files`-mode dataset), `serve_https.py`
  (local HTTPS+CORS+PNA+range server), `certs/`. Real platform datasets are downloaded
  into gitignored `test/<platform>/` dirs for end-to-end testing.
- `docs/formats.md` — per-platform reader reference + real-data deviations.
  `docs/input-spec.md` — the common model + `files` mode.
  `context/data-layouts.md` — the observed directory trees + file headers per format.

## Commands

```bash
python test/make_synthetic_data.py --outdir test/data                 # tiny files-mode dataset
nextflow run main.nf --format auto   --folder <platform_outs>     --sample_name X --outdir results
nextflow run main.nf --format files  --cells c.csv --matrix m.csv --sample_name X --outdir results
python test/serve_https.py --root results --port 8443                 # serve for browser viewing
```

There is no separate unit-test suite; validation is end-to-end: run the workflow on a
dataset, then load the published folder in Samui. A reader can be validated without
Docker by installing the package (`uv pip install --no-deps .` from the repo root, plus
the deps in `uvInstall`) and importing `loopy.spatial_io.<fmt>`, then checking the
returned `SpatialSample`.

## Runtime: no Dockerfile

The process runs in the prebuilt `ghcr.io/astral-sh/uv` image (`--uv_image`) and
installs deps at runtime with `uv` into a per-task `.venv` (see `uvInstall` in
`modules/common.nf`). The `loopy` package — readers + `preprocess` CLI included — is
installed `--no-deps` from **this repo checkout**: `main.nf` stages `pyproject.toml`,
`README.md`, and `loopy/` into the task, `preprocess.nf` assembles them into `samui_src/`,
and `uvInstall` runs `uv pip install --no-deps ./samui_src`. So runtime uses the current
working tree (no push needed), and the GUI/`PyQt5` deps are skipped. The host uv cache
(`--uv_cache`, mounted at `/uv-cache`) makes repeat runs fast. Use the **full** `bookworm`
image, not `slim` — rasterio's bundled GDAL needs `libexpat.so.1`, which slim lacks.

## Key facts that constrain the implementation

- **loopy needs Pydantic v1.** loopy uses v1 idioms (`.json(exclude=...)`, `@validator`).
  The runtime install pins `pydantic<2` and installs the package `--no-deps` (which skips
  the unused PyQt5 GUI dependency), supplying loopy's runtime deps explicitly in `uvInstall`.
  This pin is why `uv_image` is Python **3.11**, not 3.12: under `pydantic<2`, uv can only
  resolve a modern `spatialdata` (0.7.x) on 3.11; on 3.12 it backtracks to `spatialdata`
  0.3.0, whose pinned `numba`/`llvmlite` don't build on 3.12. Verified in-container.
- **`Sample` is lazy.** `add_coords` / `add_chunked_feature` / `add_image` /
  `set_default_feature` queue work; nothing is written until `.write()`.
- **Coords need a unique string index** with `x`/`y` columns; feature-group ids must
  match. `build._check_overlap` only *validates* id overlap (errors on none, warns on
  partial); loopy's `join_idx` does the actual left-join, so don't re-implement it here
  and don't `reindex` (which injects NaN rows that serialize as bogus categories/values).
- **Sparse orientation flips between formats**: 10x `.h5`/MEX are feature×observation;
  AnnData `.h5ad` is observation×feature. The `common.py` readers normalize to obs×feature.
- **Expression matrices stay sparse end-to-end.** The readers return a pandas
  sparse-backed frame (`from_spmatrix`, never `.toarray()`), `expression_group` filters
  columns without densifying, and loopy's `sparse_compress_chunked_features` converts via
  `df.sparse.to_coo()`. This keeps large panels tractable — Xenium Prime (~9.5k genes ×
  ~407k cells, 80M nnz) peaks at ~5 GB instead of the ~15–31 GB a dense matrix would need.
- **Image + coords share one pixel space.** Each reader sets `mpp` (meters/pixel) from
  the platform's units (microns → `µm·1e-6`; image pixels → pixel size); it's applied to
  both coords and image so the overlay lines up. `--mpp`/`--pixel-size`/`--spot-size`
  override. Imaging morphology images still load whole into RAM, so the process asks for 16 GB.

## Viewing constraint (important)

Samui's URL loader **forces `https://`** on the data host and fetches cross-origin, so:
- A plain `http.server` will not work via `?url=...`. Serve over **HTTPS with CORS**
  (`test/serve_https.py`), or drag-drop the folder into Samui.
- Local self-signed certs must be trusted by the browser **manually** — and a
  click-through on the interstitial only covers top-level navigation, **not** Samui's
  cross-origin `fetch()`. Add the cert to the OS trust store (keychain) instead. Chrome
  **Private Network Access** also gates public→localhost; `serve_https.py` sends
  `Access-Control-Allow-Private-Network: true` and supports range requests. Drag-drop
  avoids all of this. See README "Local testing over HTTPS".

## Known environment issue

`docker run -i` hangs after container exit on some Docker Desktop builds (seen on
29.4.1/macOS); since Nextflow always passes `-i`, runs stall with the task stuck
"RUNNING" while the `nxf-*` container shows `Exited (0)`. Restart/update Docker.
