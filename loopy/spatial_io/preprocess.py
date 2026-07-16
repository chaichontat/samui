#!/usr/bin/env python3
"""Preprocess a spatial dataset into a Samui sample folder.

One entrypoint, three input modes selected by --format:
  - a named platform (xenium, visium, visium_hd, cosmx) read from a --folder, or
    `auto` to detect the platform from it;
  - `spatialdata` from a SpatialData --zarr (.zarr.zip or .zarr directory);
  - `files` from individual --image / --cells / --features / --matrix files.

Every mode produces the same intermediate (coordinates + feature groups + image)
which is written as sample.json plus the image/coords/feature assets. The Samui viewer
that opens this folder is co-hosted alongside it by the workflow (see modules/site.nf).

Installed as the `preprocess` console script; the Nextflow module invokes it.
"""
import argparse
from pathlib import Path

from loopy.spatial_io import detect_format, get_reader
from loopy.spatial_io.build import build_sample


def main() -> None:
    """Parse CLI arguments, dispatch to the format reader, apply overrides, and build the sample."""
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--format", required=True, help="platform/mode, or 'auto' to detect from --folder")
    p.add_argument("--outdir", type=Path, required=True, help="parent directory of the sample folder")
    p.add_argument("--sample-name", required=True)

    # Input sources (which one is used depends on --format).
    p.add_argument("--folder", type=Path, help="platform output directory (named platform or auto)")
    p.add_argument("--zarr", type=Path, help="SpatialData .zarr.zip or .zarr directory")
    p.add_argument("--image", type=Path, help="files mode: TIFF/OME-TIFF image")
    p.add_argument("--cells", type=Path, help="files mode: per-cell table (coordinates + labels)")
    p.add_argument("--features", type=Path, help="files mode: per-feature (gene) metadata table")
    p.add_argument("--matrix", type=Path, help="files mode: expression matrix (cells x features)")

    # Calibration / presentation overrides (each reader sets sensible defaults).
    p.add_argument("--mpp", type=float, default=None, help="meters per pixel (overrides platform value)")
    p.add_argument("--pixel-size", type=float, default=None, help="microns per pixel (imaging platforms)")
    p.add_argument("--spot-size", type=float, default=None, help="marker diameter in meters")
    p.add_argument("--coords-name", default=None, help="name of the coordinate set")
    p.add_argument("--default-feature", default=None, help="feature shown by default on load")

    # Image / output.
    p.add_argument("--convert-8bit", action="store_true", help="downcast the image to 8-bit")
    p.add_argument("--no-image", action="store_true", help="skip the background image")
    args = p.parse_args()

    fmt = args.format
    if fmt == "auto":
        if not args.folder:
            p.error("--format auto requires --folder")
        fmt = detect_format(args.folder)
        print(f"auto-detected format: {fmt}")

    sample = get_reader(fmt)(args)

    # Apply explicit CLI overrides on top of the reader's defaults.
    if args.mpp is not None:
        sample.mpp = args.mpp
    if args.spot_size is not None:
        sample.spot_size = args.spot_size
    if args.coords_name:
        sample.coords_name = args.coords_name
    if args.no_image:
        sample.image = None
    if args.default_feature and sample.features:
        group = next((g.name for g in sample.features if g.data_type == "quantitative"), sample.features[0].name)
        sample.default_feature = (group, args.default_feature)

    build_sample(
        sample,
        outdir=args.outdir,
        name=args.sample_name,
        convert_8bit=args.convert_8bit,
    )


if __name__ == "__main__":
    main()
