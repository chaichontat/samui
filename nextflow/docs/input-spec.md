# Common model and `files` mode

## The common model

Whatever the `--format`, every reader produces the same intermediate (a
`SpatialSample` in `loopy/spatial_io/common.py`):

- **Coordinates** — one `(x, y)` per observation, in pixels, indexed by a unique
  string observation id. `mpp` (meters per pixel) calibrates them and the image.
- **Feature groups** — zero or more named tables keyed by the same id, each either
  `quantitative` (gene expression, QC metrics) or `categorical` (clusters, cell
  types). Gene-expression groups are stored sparse.
- **Image** — an optional background TIFF/OME-TIFF, written as a tiled pyramidal COG.

`build.py` writes this as `sample.json` + `<coords_name>.csv` + a `.bin`/`.json` pair
per feature group + the COG, and (optionally) an `index.html`. Platform readers
([`docs/formats.md`](formats.md)) only differ in where the bytes live and what units
the coordinates are in.

## `files` mode (`--format files`)

For data that isn't in one of the supported platform layouts, supply the pieces
directly — the AnnData decomposition as separate files:

| Param | Required | Format | Role |
|-------|----------|--------|------|
| `--cells` | **yes** | CSV / Parquet | per-observation table (`obs`): the id column + `x`/`y` coordinates + any label/metric columns |
| `--matrix` | **yes** | CSV / Parquet / 10x `.h5` / MEX dir | expression matrix (`X`), cells × features (orientation auto-detected against the cell ids) |
| `--features` | no | CSV / Parquet | per-feature metadata (`var`); if it has a feature-type column, it is used to keep only gene-expression features |
| `--image` | no | TIFF / OME-TIFF | background image |

- **Coordinates:** the `--cells` table must have an id column (`id`/`cell_id`/`barcode`/…)
  and `x`/`y` columns (aliases like `x_centroid`/`center_x`/`pxl_col_in_fullres` are
  accepted). Remaining non-numeric columns become a categorical **Annotations** group;
  remaining numeric columns become a quantitative **Cell metrics** group.
- **Expression:** control/background features (`NegPrb*`, `SystemControl*`, `Blank-*`)
  are dropped; observation ids are matched to the cells table.
- **Calibration:** `--mpp` defaults to `1.0` (coordinates are treated as image pixels);
  `--spot_size` defaults to `1e-5` m. Override as needed.

```bash
nextflow run main.nf --format files \
    --cells cells.csv --matrix expression.csv --image image.tif \
    --mpp 0.5e-6 --spot_size 1e-5 --default_feature GENE1 \
    --sample_name s1 --outdir results
```

`test/make_synthetic_data.py` writes a tiny `files`-mode dataset (a `cells.csv`, a
`matrix.csv`, and an `image.tif`) for a quick end-to-end check.
