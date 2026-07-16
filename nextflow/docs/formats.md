# Supported formats

Every reader lives in `loopy/spatial_io/<format>.py` and returns one `SpatialSample`
(coordinates keyed by a unique string observation id + named feature groups +
optional image), which `loopy/spatial_io/build.py` turns into a loopy Sample. The
shared matrix decoders, control-feature filtering and 10x clustering reader live in
`loopy/spatial_io/common.py`; each reader only locates files and normalizes ids/units.

Select a reader with `--format`. Folder-based platforms take `--folder`; `spatialdata`
takes `--zarr`; `files` takes `--image`/`--cells`/`--features`/`--matrix`. `auto`
sniffs `--folder` (handling a Space Ranger `outs/` wrapper) and dispatches.

Each row notes the calibration the reader derives, the feature groups it emits, and
anything in the **real test dataset** that deviated from the published format spec.
"Tested with" names the dataset the reader was validated against end-to-end. The
concrete directory trees and file headers observed in those datasets are recorded in
[`../context/data-layouts.md`](../context/data-layouts.md).

---

## Xenium (`xenium`, `--folder`)
- **Observation:** cell. **Coords:** `cells.parquet`/`cells.csv.gz` `x/y_centroid` (microns) ÷ `pixel_size` → pixels; `mpp = pixel_size·1e-6` (from `experiment.xenium`, default 0.2125 µm). **spot_size** 10 µm.
- **Expression:** `cell_feature_matrix/` (MEX) or `cell_feature_matrix.h5`, filtered to `Gene Expression`.
- **Annotations:** `analysis/clustering/*/clusters.csv` → categorical **Clusters**. **QC metrics** from the `cells` table.
- **Image:** `morphology_focus.ome.tif` (or `morphology_mip`), channel `DAPI`, with graceful fallback if the JPEG-2000 OME-TIFF can't be decoded.
- **Tested with:** Xenium V1 FF Mouse Brain Coronal Subset (36,602 cells, 248 genes, image).
- **Note:** v2.0+ multi-file `morphology_focus/` directories aren't handled (degrades to image-less).

## Visium (`visium`, `--folder`)
- **Observation:** 55 µm spot. **Coords:** `spatial/tissue_positions*.csv`/`.parquet`, `x=pxl_col_in_fullres`, `y=pxl_row_in_fullres`, filtered to `in_tissue==1`. `mpp = (55 / spot_diameter_fullres)·1e-6` from `scalefactors_json.json`. **spot_size** 55 µm.
- **Expression:** `filtered_feature_bc_matrix.h5` or `/` (MEX), filtered to `Gene Expression`. **Annotations:** `analysis/clustering/*` → **Clusters**.
- **Image:** none (public minimal sets ship only PNG previews).
- **Tested with:** Targeted Visium Human Glioblastoma (Pan-Cancer), SR 1.2 (3,468 in-tissue spots, 1,253 genes).
- **Deviation found:** SR 1.x ships `tissue_positions_list.csv` (the `_list` suffix), **headerless**; the reader detects header presence and the fixed column order. (SR ≥1.3 has a header; SR 2.0+ is parquet.)

## Visium HD (`visium_hd`, `--folder`)
- **Observation:** square bin. Reader uses the **coarsest** available bin (prefers `square_016um`). **Coords:** `binned_outputs/square_NNNum/spatial/tissue_positions.parquet` (parquet), `in_tissue==1`, x/y from `pxl_col/row_in_fullres`. `mpp` from `scalefactors_json.json` `microns_per_pixel` (fallback `bin_um / spot_diameter_fullres`). **spot_size** = bin size.
- **Expression:** `square_NNNum/filtered_feature_bc_matrix.h5`. **Annotations:** that bin's `analysis/clustering/*`.
- **Tested with:** Visium HD Tiny 3' Mouse Brain, SR 4.0.1 (5,262 in-tissue 16 µm bins, 32,245 genes).
- **Not implemented:** the `segmented_outputs/` per-cell path (needs GeoJSON-centroid parsing and the integer `cell_id` ↔ `cellid_00000000N-1` translation) — noted as a future extension in the module.

## CosMx SMI (`cosmx`, `--folder`)
- **Observation:** cell. **Coords:** `*_metadata_file.csv` `CenterX/Y_global_px` (pixels); `mpp` default 0.12028 µm/px (override with `--pixel_size`). **spot_size** 10 µm.
- **Expression:** `*_exprMat_file.csv` (row per cell), join key = composite `f"{fov}_{cell_ID}"`, `cell_ID==0` (background) dropped; `NegPrb*`/`SystemControl*` dropped. **Cell metrics** (Area, intensities, …) as a quantitative group. No native annotation.
- **Tested with:** NSCLC Lung9_Rep1 legacy SMI flat files (91,972 cells, 960 genes, 20 NegPrb dropped).
- **Deviations found:** legacy 2021 export — filenames **prefixed**, **no `polygons.csv`** (boundaries are `CellLabels/*.tif` masks, unused), no `SystemControl*` columns present. Column lookups are case/alias tolerant (`fov`/`FOV`, `cell_ID`/`cell_id`).

## SpatialData (`spatialdata`, `--zarr`)
- Reads a `.zarr.zip` (extracted to a temp dir) or `.zarr` directory via the `spatialdata` package. Takes the AnnData table; **coords** from the table's `obsm['spatial']` if present, else the matching `shapes` GeoDataFrame `.geometry.centroid` joined on the table's instance key. **Expression** from `X`; categorical `obs` → **Annotations**. `mpp=1e-6` default. Image not exported (future extension).
- **Tested with:** scverse sandbox MERFISH (2,389 cells, coords via shapes-centroid) and MIBI-TOF (3,309 cells, coords via `obsm['spatial']`).
- **Deviation found:** the sandbox stores are **Zarr v3** (`zarr.json`) and unzip to a store literally named `data.zarr/`. The MERFISH table has **no** `obsm['spatial']` (coords come from shapes); MIBI-TOF has it.
- **Deviation found:** stores written by older spatialdata can carry `obs`/`var` names with characters `spatialdata` >=0.7 now rejects at read (e.g. `µm`, `^2`, `a/b`), raising `ValidationError` inside `read_zarr`. The reader catches this and falls back to reading non-table elements via `selection` plus each table directly through `anndata`, then `spatialdata.sanitize_table` (invalid chars → `_`, collisions de-duplicated) — so the sanitized names become the feature/annotation labels.

## files (`files`, `--image`/`--cells`/`--features`/`--matrix`)
The platform-agnostic AnnData decomposition expressed as separate files — see
[`input-spec.md`](input-spec.md).
