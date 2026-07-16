"""10x Visium HD reader (Space Ranger v4.0+).

Uses the binned outputs at the coarsest available bin (prefer square_016um, else
008, else 002) to keep the published sample a manageable size. Coordinates come
from `spatial/tissue_positions.parquet` in full-res image pixels; calibration uses
the `microns_per_pixel` key in `scalefactors_json.json`.

Segmented single cells (`segmented_outputs/`) are a possible future extension: it
would require parsing `cell_segmentations.geojson` centroids and mapping the integer
geojson cell ids to the matrix barcodes (`cellid_00000000N-1`). Not implemented here.
"""
from __future__ import annotations

import json
from argparse import Namespace
from pathlib import Path

import pandas as pd

from .common import (
    FeatureGroup,
    SpatialSample,
    as_str_index,
    expression_group,
    fail,
    read_10x_clusters,
    read_10x_h5,
)

BIN_PREFERENCE = ("square_016um", "square_008um", "square_002um")


def _bin_dir(folder: Path) -> Path:
    """Return the coarsest available bin directory under binned_outputs/ (see `BIN_PREFERENCE`)."""
    binned = folder / "binned_outputs"
    if not binned.is_dir():
        fail(f"visium_hd format requires binned_outputs/ under {folder}")
    for name in BIN_PREFERENCE:
        cand = binned / name
        if cand.is_dir():
            return cand
    fail(f"no recognized bin directory in {binned}; expected one of {BIN_PREFERENCE}")


def _calibration(bin_dir: Path, bin_size_um: float, override: float | None) -> float:
    """Return microns/pixel for this bin from scalefactors_json.json (or override)."""
    if override is not None:
        return override
    sf = bin_dir / "spatial" / "scalefactors_json.json"
    if not sf.exists():
        fail(f"missing {sf}")
    data = json.loads(sf.read_text())
    if "microns_per_pixel" in data:
        return float(data["microns_per_pixel"])
    if "spot_diameter_fullres" in data:
        # spot_diameter_fullres is the bin pitch in full-res pixels.
        return bin_size_um / float(data["spot_diameter_fullres"])
    fail(f"scalefactors_json.json has neither microns_per_pixel nor spot_diameter_fullres: {sf}")


def _coords(bin_dir: Path) -> pd.DataFrame:
    """Read in-tissue bin coordinates (full-res pixels) from the bin's tissue_positions.parquet."""
    positions = bin_dir / "spatial" / "tissue_positions.parquet"
    if not positions.exists():
        fail(f"missing {positions}")
    df = pd.read_parquet(positions)
    df = df[df["in_tissue"] == 1]
    if df.empty:
        fail(f"no in_tissue bins in {positions}")
    return pd.DataFrame(
        {"x": df["pxl_col_in_fullres"].to_numpy(), "y": df["pxl_row_in_fullres"].to_numpy()},
        index=as_str_index(df["barcode"]),
    )


def read(args: Namespace) -> SpatialSample:
    """Read a 10x Visium HD output directory into a `SpatialSample`.

    Uses the coarsest available bin (see `BIN_PREFERENCE`); coordinates are the
    in-tissue bins' full-resolution pixel positions, feature groups are gene
    expression and 10x clusters (if present). No image is attached.
    """
    folder = args.folder
    if not folder or not folder.is_dir():
        fail("visium_hd format requires --folder pointing at a Space Ranger output directory")

    bin_dir = _bin_dir(folder)
    bin_size_um = float(bin_dir.name.removeprefix("square_").removesuffix("um"))
    print(f"visium_hd: using bin {bin_dir.name} (microns_per_pixel from scalefactors_json.json)")

    h5 = bin_dir / "filtered_feature_bc_matrix.h5"
    if not h5.exists():
        fail(f"missing {h5}")
    counts, ftype = read_10x_h5(h5)
    features = [expression_group(counts, ftype)]

    clusters = read_10x_clusters(bin_dir / "analysis")
    if clusters is not None:
        features.append(clusters)

    mpp_um = _calibration(bin_dir, bin_size_um, args.pixel_size)

    return SpatialSample(
        coords=_coords(bin_dir),
        mpp=mpp_um * 1e-6,
        coords_name="bins",
        spot_size=bin_size_um * 1e-6,
        features=features,
        image=None,
    )
