# Nextflow preprocessing workflow

The `nextflow/` module of the [Samui](https://samuibrowser.com) repo: a Nextflow
workflow that preprocesses spatial-transcriptomics data into a Samui browser sample
folder, ready to host and view. It is the batch/headless counterpart to Samui's
interactive preprocessing GUI.

It drives the repo's own `loopy` package (its readers live in `../loopy/spatial_io/`).
Every input — whichever platform or format it comes in — is reduced to one common
model (coordinates + feature groups + an optional image, joined by observation id)
and written as a self-contained folder (`sample.json` + a tiled cloud-optimized
GeoTIFF + chunked feature data) that Samui loads over HTTP or by drag-and-drop.

## Requirements

- [Nextflow](https://www.nextflow.io/) >= 23.10
- Docker

There is **no Dockerfile to build**. The process runs in the prebuilt
[`ghcr.io/astral-sh/uv`](https://github.com/astral-sh/uv) image and installs its
dependencies at runtime with `uv` into a per-task virtualenv: the loopy deps
(pinning `pydantic<2`, which loopy requires) plus the `loopy` package itself — which
carries the readers and the `preprocess` CLI — installed `--no-deps` from **this repo
checkout** (staged into the task, so runtime uses the current working tree), plus a
small set of extra packages chosen per `--format`. Downloads are cached on the host
(`--uv_cache`, default `~/.cache/samui-preprocess-uv`) and mounted into each task, so
only the first run pays the install cost. Override the base image with `--uv_image` if
you need a different Python/arch.

## Run

There is a single entrypoint, `main.nf`. The required `--format` selects the input
mode and which other parameters apply:

| `--format` | input parameter(s) | what it reads |
|---|---|---|
| `xenium` | `--folder` | 10x Xenium output directory |
| `visium` | `--folder` | 10x Visium (Space Ranger) `outs/` (or its parent) |
| `visium_hd` | `--folder` | 10x Visium HD `outs/` (coarsest `square_NNNum` bin) |
| `cosmx` | `--folder` | CosMx SMI flat-file export |
| `auto` | `--folder` | sniff the folder and pick one of the above |
| `spatialdata` | `--zarr` | a SpatialData `.zarr.zip` or `.zarr` directory |
| `files` | `--image` / `--cells` / `--features` / `--matrix` | individual files |

```bash
# A platform output directory
nextflow run main.nf --format xenium --folder path/to/Xenium_outs --sample_name brain --outdir results

# Let the workflow detect the platform
nextflow run main.nf --format auto --folder path/to/outs --sample_name s1 --outdir results

# A SpatialData store
nextflow run main.nf --format spatialdata --zarr path/to/sample.zarr.zip --sample_name s2 --outdir results

# Individual files (AnnData decomposition)
nextflow run main.nf --format files \
    --image path/to/image.tif \
    --cells path/to/cells.csv \
    --matrix path/to/expression.csv \
    --features path/to/genes.csv \
    --sample_name s3 --outdir results
```

The sample folder is published to `<outdir>/<sample_name>/`. See
[`docs/formats.md`](docs/formats.md) for the per-platform layout each reader expects
(and the deviations found in real data) and [`docs/input-spec.md`](docs/input-spec.md)
for the common model and the `files` mode in detail.

### Parameters

Each reader derives sensible calibration from the platform's own metadata; these
override it where needed.

| Param | Default | Description |
|-------|---------|-------------|
| `--format` | _(required)_ | input mode (table above) |
| `--folder` / `--zarr` / `--image`,`--cells`,`--features`,`--matrix` | _(none)_ | input source for the chosen mode |
| `--outdir` | `results` | directory the sample folder is published into |
| `--sample_name` | `sample` | sample folder name; also the `&s=` value in the Samui URL |
| `--mpp` | _(per reader)_ | meters per pixel (image + coords) |
| `--pixel_size` | _(per reader)_ | microns per pixel (imaging platforms) |
| `--spot_size` | _(per reader)_ | marker diameter in meters |
| `--coords_name` | _(per reader)_ | name of the coordinate set (spots/cells/bins/…) |
| `--default_feature` | _(none)_ | feature shown automatically on load |
| `--convert_8bit` | `false` | downcast the image to 8-bit |
| `--no_image` | `false` | skip the background image |
| `--samui_version` | `v1.1.0` | Samui release tag/branch/commit to build |
| `--node_image` | `node:22-bookworm` | container used to build the viewer (Samui needs node ≥22) |

### File inputs (`--format files`)

When no platform reader fits, `--format files` takes the pieces of an AnnData object as
separate files, joined by a shared observation (cell/spot) id:

| Param | Required | Accepted formats | Contents |
|-------|----------|------------------|----------|
| `--cells` | **yes** | CSV, Parquet | one row per observation: an id column, `x`/`y` coordinates, and any number of label/metric columns |
| `--matrix` | **yes** | CSV, Parquet, 10x `.h5`, MEX directory | the expression matrix (counts), observations × features |
| `--features` | no | CSV, Parquet | one row per feature (gene); used to restrict the matrix to gene-expression features |
| `--image` | no | TIFF, OME-TIFF | background image drawn under the points |

**`--cells`** — the coordinate/metadata table (AnnData `obs`).
- *Id column* (optional): the first column named (case-insensitive) `id`, `cell_id`,
  `barcode`, `cell`, `obs`, or `observation_id` becomes the observation id. If none is
  present, the row number is used as the id, so the matrix must then align by position.
- *Coordinates* (required): `x` and `y` columns, in image pixels. Aliases are accepted —
  `x`/`x_centroid`/`center_x`/`px_x`/`pxl_col_in_fullres` and the `y` equivalents.
- *Everything else* becomes overlays: text columns form a categorical **Annotations**
  group, numeric columns a quantitative **Cell metrics** group.

**`--matrix`** — the expression matrix (AnnData `X`); values are counts.
- CSV/Parquet: the first column holds the ids and the rest are feature columns. The
  orientation (observations as rows or columns) is detected by matching against the
  `--cells` ids, so a transposed matrix is fine.
- A 10x `.h5` file or a MEX directory (`matrix.mtx[.gz]` + `features`/`genes` + `barcodes`)
  is read directly.
- Control/background features are dropped by name prefix (`NegPrb*`, `NegControl*`,
  `SystemControl*`, `Blank-*`/`BLANK_*`).

**`--features`** — per-feature metadata (AnnData `var`), optional. The first column is the
feature id. If any column name contains `type` (e.g. 10x `feature_types`), only features
typed `Gene Expression` are kept.

**Calibration.** Coordinates are treated as image pixels unless you pass `--mpp`
(meters/pixel); `--spot_size` (marker diameter in meters) defaults to `1e-5`, and the
coordinate set is named `cells`.

A minimal `cells.csv`:

```csv
id,x,y,cell_type,area
cell_1,120.5,88.0,Tumor,42.1
cell_2,131.2,90.4,Stroma,37.8
```

and a matching `expression.csv` (ids in the first column, features as columns):

```csv
,GENE1,GENE2,GENE3
cell_1,3,0,5
cell_2,0,2,1
```

`test/make_synthetic_data.py` writes a tiny working `files`-mode dataset (`cells.csv`,
`matrix.csv`, `image.tif`) you can run end-to-end.

## Output (the published sample folder)

`<outdir>/<sample_name>/` contains everything Samui needs: `sample.json` (the
manifest), `<coords_name>.csv`, one `<group>.bin` + `<group>.json` per feature group
(gene expression, clusters/annotations, QC metrics — whichever the platform has), and,
if an image was added, a tiled pyramidal cloud-optimized GeoTIFF.

## Hosting and viewing

### Bundled single-origin site

The workflow downloads a Samui release (`--samui_version`), builds its static site,
and publishes it **at the output root** alongside the data:

```bash
nextflow run main.nf --format auto --folder path/to/outs \
    --sample_name s1 --outdir results
```

```
results/
├── index.html        # the Samui viewer; auto-loads the co-hosted sample in place
├── _app/ …           # the viewer's assets (built from the release)
└── <sample_name>/     # the data
```

Serve `results/` and open `index.html`: it points the viewer at the sibling
`<sample_name>/` folder via `history.replaceState` (no redirect), so the data loads on
the same URL and a browser refresh reloads the same view. The viewer and the data are
on **one origin**, so there
are no cross-origin fetches — which sidesteps CORS, Chrome's Private Network Access,
and the data-host whitelist on the public `samuibrowser.com`. (Self-signed-cert local
hosting still needs a one-time cert trust for the top-level page, but same-origin
fetches then just work.) Build requires node ≥22 (`--node_image`); the build runs once
per `--samui_version` and is cached on `-resume`.

### View the sample folder in a hosted Samui

The `<sample_name>` data folder also works with a hosted Samui without the bundled
viewer:

1. **Open by URL.** Serve the *parent* of the sample folder over HTTPS+CORS and open
   `https://samuibrowser.com/from?url=<HOST>&s=<sample_name>`, where `<HOST>` is the
   host/path **without** a scheme (e.g. `data.example.com/spatial`).

2. **Drag-and-drop** the `<sample_name>` folder onto https://samuibrowser.com — no
   server needed; all processing is local to the browser.

> Samui forces `https://` on the data host and fetches cross-origin, so the data must
> be served over HTTPS with CORS. The bundled site avoids this by serving the viewer
> and data from one origin.

### Local testing over HTTPS

Because Samui forces HTTPS, a plain `python -m http.server` will not work via the
URL loader. Use the included helper, which serves over HTTPS with CORS:

```bash
# one-time self-signed cert (already generated under test/certs/ in this repo)
openssl req -x509 -newkey rsa:2048 -nodes -keyout test/certs/key.pem \
    -out test/certs/cert.pem -days 365 -subj "/CN=localhost" \
    -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"

python test/serve_https.py --root results --port 8443
```

Then make Chrome **genuinely trust** the self-signed cert (this step is manual —
self-signed certs can't be accepted programmatically). Clicking **Advanced → Proceed**
on the interstitial only overrides the cert for *top-level* navigation; Samui fetches
the data *cross-origin*, and Chrome does **not** apply that override to cross-origin
`fetch()` — those still fail with `net::ERR_CERT_*` ("Failed to fetch"). Trust it properly:

```bash
# macOS: add the repo cert to the system keychain as a trusted root, then fully restart Chrome
sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain \
    test/certs/cert.pem
```

Even with a trusted cert, Chrome's **Private Network Access** policy gates requests
from a public origin (`samuibrowser.com`) to a local one (`localhost`); `serve_https.py`
answers the PNA preflight with `Access-Control-Allow-Private-Network: true` and serves
HTTP **range** requests (which the COG image reader needs). Enforcement can still be
finicky per browser/version. The most reliable local check that avoids HTTPS, CORS and
PNA entirely is **drag-and-drop**: open https://samuibrowser.com and drag the
`<outdir>/<sample_name>` folder onto it.

## Known issue: `docker run -i` hang on Docker Desktop

On some Docker Desktop builds (observed with 29.4.1 on macOS), `docker run -i`
does not return after the container exits — the work completes but the client
hangs, so Nextflow never sees the task finish. Nextflow always passes `-i`.
If `nextflow run` stalls with the task stuck "RUNNING" while
`docker ps -a` shows the `nxf-*` container `Exited (0)`, this is the cause.
Workarounds: restart Docker Desktop, or update Docker. (For CI/cloud executors
this does not occur.)
