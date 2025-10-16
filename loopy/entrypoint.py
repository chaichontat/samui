from pathlib import Path

import rich_click as click

from loopy.logger import log
from loopy.sample import Sample
from loopy.server import serve_samui


@click.group()
def cli():
    pass


@cli.command()
@click.argument("tiff", nargs=1, type=click.Path(exists=True, dir_okay=False, path_type=Path))
@click.option(
    "out",
    "--out",
    "-o",
    type=click.Path(file_okay=False, path_type=Path),
    help="Output directory containing the Loopy files. Defaults to the same directory as the input file.",
)
@click.option(
    "name",
    "-n",
    "--name",
    type=str,
    default=None,
    help="Name of the experiment. Defaults to file name. \
If you're combining this image with the spaceranger output, the name here must match the name given in that processing command.",
)
@click.option(
    "channels",
    "--channels",
    "-c",
    type=str,
    help="Channel names, split by comma. The number of channels must match those in the image.",
)
@click.option("scale", "--scale", "-s", default=1, type=float, help="Scale in meters per pixel.", show_default=True)
@click.option(
    "translate",
    "--translate",
    default=(0, 0),
    nargs=2,
    type=click.Tuple([float, float]),
    help="Translation to be applied in y and x.",
)
@click.option("--convert8bit", is_flag=True, help="Convert the image to 8-bit. ")
@click.option(
    "quality",
    "--quality",
    default=90,
    type=int,
    help="JPEG compression quality. Only applies if image is 8-bit or converting to 8-bit.",
    show_default=True,
)
def image(
    tiff: Path,
    out: Path | None = None,
    name: str | None = None,
    channels: str | None = None,
    convert8bit: bool = False,
    quality: int = 90,
    scale: float = 1,
    translate: tuple[float, float] = (0, 0),
) -> None:
    """Convert a TIFF file to a Loopy (COG) file."""
    import tifffile

    img = tifffile.imread(tiff)
    if name is None:
        name = tiff.stem
    if out is None:
        out = tiff.parent

    log(f"Processing {name} from file {tiff} with shape {img.shape}.")
    match channels:
        case None:
            c = None
        case "rgb":
            c = "rgb"
        case _:
            c = channels.split(",")

    (
        Sample(name=name, path=out / name)
        .add_image(tiff, channels=c, scale=scale, translate=translate, quality=quality, convert_to_8bit=convert8bit)
        .write()
    )


@cli.command()
@click.argument("spaceranger_output", nargs=1, type=click.Path(exists=True, file_okay=False, path_type=Path))
@click.option(
    "out",
    "--out",
    "-o",
    nargs=1,
    type=click.Path(file_okay=False, path_type=Path),
    help="Output directory containing the Loopy files. \
Defaults to the spaceranger output's parent directory / loopy.",
)
@click.option(
    "name",
    "--name",
    "-n",
    type=str,
    help="Name of the experiment. Defaults to the one in the spaceranger's `--id` argument.",
)
@click.option(
    "spotDiam",
    "--spotDiam",
    default=55e-6,
    type=float,
    help="Diameter of the spots in meters.",
    show_default=True,
)
@click.option(
    "logTransform",
    "--logTransform",
    default=True,
    type=bool,
    help="Whether to log2-transform the data.",
    show_default=True,
)
def spaceranger(spaceranger_output: Path, out: Path | None, name: str, spotDiam: float, logTransform: bool) -> None:
    """Get gene expression data from a spaceranger experiment. \
Assumes that Visium alignment has been done."""
    from loopy.drivers.spaceranger import run_spaceranger

    if out is None:
        out = spaceranger_output.parent / "loopy"

    run_spaceranger(name, spaceranger_output, out, spotDiam=spotDiam)
    # modify_sample(s, out, name)


@cli.command()
def gui():
    """Start the Loopy Preprocessing GUI."""
    from loopy.gui.app import main

    main()


@cli.command()
@click.argument("h5ad", nargs=1, type=click.Path(exists=True, dir_okay=False, path_type=Path))
@click.option(
    "out",
    "--out",
    "-o",
    type=click.Path(file_okay=False, path_type=Path),
    default=None,
    help="Root output directory. Defaults to ./loopy next to input file.",
)
@click.option("name", "--name", "-n", type=str, default=None, help="Sample name. Defaults to the .h5ad stem.")
@click.option("coords_name", "--coords-name", type=str, default="spatial", help="Coordinate set name.")
@click.option("feature_name", "--feature-name", type=str, default="genes", help="Feature group name.")
@click.option("m_per_px", "--m-per-px", type=float, default=1.0, help="Meters per pixel for coords.")
@click.option("size", "--size", type=float, default=None, help="Spot diameter in meters. Defaults to auto (heuristic).")
@click.option("unit", "--unit", type=str, default="counts", help="Unit string for the feature values.")
@click.option("--serve", is_flag=True, help="Start a local web server to browse the output after writing.")
@click.option("--serve-host", default="127.0.0.1", show_default=True, help="Server host to bind.")
@click.option(
    "--host",
    "serve_host",
    help="Alias for --serve-host (use 0.0.0.0 or your LAN IP for external access).",
)
@click.option("--serve-port", default=8000, type=int, show_default=True, help="Server port to bind.")
@click.option(
    "--serve-open/--serve-no-open",
    "serve_open",
    default=True,
    show_default=True,
    help="Open the browser automatically when serving.",
)
def h5ad(
    h5ad: Path,
    out: Path | None,
    name: str | None,
    coords_name: str,
    feature_name: str,
    m_per_px: float,
    size: float | None,
    unit: str,
    serve: bool,
    serve_host: str,
    serve_port: int,
    serve_open: bool,
) -> None:
    """Convert an .h5ad to a Sample using obsm['spatial'] for coordinates and X for features."""
    import numpy as np
    import pandas as pd
    import scanpy as sc
    from scipy import sparse as sp

    from loopy.utils.utils import estimate_spot_diameter, infer_feature_data_type

    try:
        ad = sc.read_h5ad(h5ad)
        if "spatial" not in ad.obsm:
            raise click.ClickException("adata.obsm['spatial'] not found in the provided .h5ad")
        if ad.obsm["spatial"] is None or ad.obsm["spatial"].shape[1] < 2:
            raise click.ClickException("adata.obsm['spatial'] must have at least two columns (x,y)")

        coords = pd.DataFrame(ad.obsm["spatial"][:, :2], columns=["x", "y"], index=ad.obs_names.astype(str))

        # Warn if the overall physical extent is unusually large (> 10 cm).
        try:
            x_extent_px = float(coords["x"].max() - coords["x"].min())
            y_extent_px = float(coords["y"].max() - coords["y"].min())
            width_m = x_extent_px * m_per_px
            height_m = y_extent_px * m_per_px
            threshold_m = 0.10  # 10 cm
            if max(width_m, height_m) > threshold_m:
                width_cm = width_m * 100
                height_cm = height_m * 100
                log(
                    "Large physical extent detected:",
                    f"~{width_cm:.2f} cm × {height_cm:.2f} cm",
                    f"(m_per_px={m_per_px:g}).",
                    "If this looks wrong, check your coordinate units or pass --m-per-px accordingly.",
                    type_="WARNING",
                )
        except Exception as e:
            log("Failed to compute extent:", str(e), type_="WARNING")

        X = ad.X
        is_sparse = sp.issparse(X)
        if is_sparse:
            X = sp.csc_matrix(X)
            feat = pd.DataFrame.sparse.from_spmatrix(X, index=ad.obs_names.astype(str), columns=ad.var_names)
        else:
            X = np.asarray(X)
            feat = pd.DataFrame(X, index=ad.obs_names.astype(str), columns=ad.var_names)

        if out is None:
            out = h5ad.parent
        sample_name = name or h5ad.stem
        out_dir = out / sample_name
        est_size_m = size or estimate_spot_diameter(coords, m_per_px=m_per_px)
        if size is None:
            log("Estimated spot diameter:", f"{est_size_m:.6e} m")

        log("Writing sample to", out_dir)
        s = Sample(name=sample_name, path=out_dir).add_coords(
            coords, name=coords_name, mPerPx=m_per_px, size=est_size_m
        )
        # Gene expression as chunked sparse
        s = s.add_chunked_feature(
            feat,
            name=feature_name,
            coordName=coords_name,
            sparse=True,
            unit=unit,
            dataType=infer_feature_data_type(feat),
        )
        # Add each obsm matrix as CSV features
        for key, val in ad.obsm.items():
            if isinstance(val, pd.DataFrame):
                df = val.copy()
                df.index = ad.obs_names.astype(str)
            else:
                arr = np.asarray(val)
                if arr.ndim == 1:
                    arr = arr.reshape(-1, 1)
                if arr.shape[0] != ad.n_obs:
                    continue
                cols = [f"{key}_{i}" for i in range(arr.shape[1])]
                df = pd.DataFrame(arr, index=ad.obs_names.astype(str), columns=cols)
            s = s.add_csv_feature(
                df,
                name=key,
                coordName=coords_name,
                dataType=infer_feature_data_type(df),
            )

        s.write()
        log("Done.")

        if serve:
            try:
                serve_samui(out, host=serve_host, port=serve_port, open_browser=serve_open, block=True)
            except ImportError:
                raise click.ClickException(
                    "FastAPI/Uvicorn not installed. Install extras with `pip install .[server]` and retry with --serve."
                )
    except Exception as e:
        raise click.ClickException(str(e))


@cli.command()
@click.argument("directory", required=True, type=click.Path(exists=True, file_okay=False, path_type=Path))
@click.option(
    "--host",
    default="127.0.0.1",
    show_default=True,
    help="Host/IP to bind (use 0.0.0.0 or your LAN IP for external access).",
)
@click.option("--port", default=8000, type=int, show_default=True, help="Port to bind.")
@click.option("--open/--no-open", "open_browser", default=True, show_default=True, help="Open browser on start.")
def serve(
    directory: Path,
    host: str,
    port: int,
    open_browser: bool,
) -> None:
    """Serve static files over HTTP.

    - Defaults to serving from ./static if it exists, otherwise the CWD.
    - Uses FastAPI+Uvicorn. Install extras with `pip install .[server]` if missing.
    """
    try:
        serve_samui(directory, host=host, port=port, open_browser=open_browser, block=True)
    except (ImportError, OSError, ValueError) as e:
        raise click.ClickException(str(e))
