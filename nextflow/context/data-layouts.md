# Observed input layouts

Concrete record of the input file/folder structure each `loopy/spatial_io/<format>.py`
reader consumes, captured from the real example datasets used to validate the
workflow. The datasets themselves are gitignored (too large) under `test/<format>/`;
this is the durable record of what they contained.

For what each reader *does* with these (calibration, feature grouping, spec
deviations), see [`../docs/formats.md`](../docs/formats.md). Columns/headers below are
the literal ones observed in the example data — treat headers as the source of truth,
not fixed positions (vendor column names drift across versions).

---

## xenium (`--folder`)
Example: Xenium V1 FF Mouse Brain Coronal Subset (`*_outs`).
```
<region>/
├── experiment.xenium            # JSON metadata (pixel_size, images{...})
├── cells.parquet | cells.csv.gz # per-cell summary (coordinates)
├── cell_feature_matrix/         # MEX: barcodes.tsv.gz, features.tsv.gz, matrix.mtx.gz
├── cell_feature_matrix.h5       # same matrix, 10x HDF5
├── analysis/clustering/<gene_expression_graphclust | gene_expression_kmeans_N_clusters>/clusters.csv
├── morphology_focus.ome.tif     # 2D background (also morphology.ome.tif z-stack, morphology_mip.ome.tif)
├── cell_boundaries.* / nucleus_boundaries.* / transcripts.* / gene_panel.json   # unused
```
- `cells.parquet` cols: `cell_id, x_centroid, y_centroid, transcript_counts, control_probe_counts, control_codeword_counts, total_counts, cell_area, nucleus_area`.
- `features.tsv.gz`: 3 cols (Ensembl id, gene name, feature type). Types seen: `Gene Expression` 248, `Blank Codeword` 225, `Negative Control Codeword` 41, `Negative Control Probe` 27 (only Gene Expression kept).
- `clusters.csv` cols: `Barcode, Cluster`. **Join key:** `cell_id` == matrix barcode == clusters `Barcode`.

## visium (`--folder`)
Example: Targeted Visium Human Glioblastoma (Pan-Cancer), Space Ranger 1.2.
```
<run>/outs/
├── filtered_feature_bc_matrix.h5      (or filtered_feature_bc_matrix/ MEX)
├── spatial/
│   ├── tissue_positions_list.csv      # SR1.x: HEADERLESS (SR>=1.3 tissue_positions.csv w/ header; SR2.0+ .parquet)
│   ├── scalefactors_json.json
│   └── *_image.png / *.jpg            # previews (no full-res TIFF in minimal set)
└── analysis/clustering/<graphclust | kmeans_N_clusters>/clusters.csv
```
- `tissue_positions_list.csv` columns (no header row): `barcode, in_tissue, array_row, array_col, pxl_row_in_fullres, pxl_col_in_fullres`. Example line: `ACGCCTGACACGCGCT-1,0,0,0,1440,2365`. Keep `in_tissue==1`; x=`pxl_col_in_fullres`, y=`pxl_row_in_fullres`.
- `scalefactors_json.json` keys: `spot_diameter_fullres, tissue_hires_scalef, fiducial_diameter_fullres, tissue_lowres_scalef`. **Join key:** spot `barcode`.

## visium_hd (`--folder`)
Example: Visium HD Tiny 3' Mouse Brain, Space Ranger 4.0.1.
```
<run>/outs/
├── binned_outputs/square_{002,008,016}um/
│   ├── filtered_feature_bc_matrix.h5
│   ├── spatial/{tissue_positions.parquet, scalefactors_json.json, ...}
│   └── analysis/clustering/.../clusters.csv
└── segmented_outputs/            # per-cell (filtered_feature_cell_matrix.h5, cell_segmentations.geojson) — NOT read
```
- Reader uses the coarsest bin (prefers `square_016um`).
- `tissue_positions.parquet` cols (parquet): `barcode, in_tissue, array_row, array_col, pxl_row_in_fullres, pxl_col_in_fullres`.
- `scalefactors_json.json` keys: `spot_diameter_fullres, bin_size_um, microns_per_pixel, tissue_lowres_scalef, fiducial_diameter_fullres, tissue_hires_scalef, regist_target_img_scalef` (reader uses `microns_per_pixel`). **Join key:** bin `barcode`.

## cosmx (`--folder`)
Example: CosMx SMI NSCLC Lung9_Rep1 (legacy 2021 flat-file export; prefixed filenames).
```
<slide>/
├── <slide>_exprMat_file.csv       # row per cell; cols: fov, cell_ID, <genes...>, NegPrb*
├── <slide>_metadata_file.csv      # per-cell coords + morphology
├── <slide>_fov_positions_file.csv # FOV offsets (unused; global px used directly)
```
- exprMat: 982 cols = `fov, cell_ID` + 960 genes + 20 `NegPrb*` (NegPrb/SystemControl dropped). No `polygons.csv` in this legacy export (boundaries are `CellLabels/*.tif`, not shipped here).
- metadata cols: `fov, cell_ID, Area, AspectRatio, CenterX_local_px, CenterY_local_px, CenterX_global_px, CenterY_global_px, Width, Height, Mean./Max.{MembraneStain,PanCK,CD45,CD3,DAPI}`. x=`CenterX_global_px`, y=`CenterY_global_px` (pixels). **Join key:** composite `f"{fov}_{cell_ID}"`, `cell_ID==0` (background) dropped.

## spatialdata (`--zarr`)
Example: scverse sandbox MERFISH + MIBI-TOF (`.zarr.zip` → store dir `data.zarr/`, Zarr **v3**).
```
data.zarr/
├── images/   ├── labels/   ├── points/   ├── shapes/   ├── tables/   (which are present varies)
├── zarr.json (+ zmetadata)
```
- merfish: `images=[rasterized] shapes=[anatomical, cells] points=[single_molecule] tables=[table]`; table `(2389, 268)`, **no `obsm['spatial']`** → coords from `shapes['cells']` centroids (joined on the table's instance key).
- mibitof: `images=[3 points] shapes=[] tables=[table]`; table `(3309, 36)`, `obsm=['X_umap','spatial','X_scanorama']` → coords from `obsm['spatial']`. **Join key:** the table's region/instance key.

## files (`--image`/`--cells`/`--features`/`--matrix`)
No fixed layout — the AnnData decomposition as separate files. See
[`../docs/input-spec.md`](../docs/input-spec.md).
