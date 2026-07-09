"""10x Xenium reader. Coordinates in microns, origin at the morphology image top-left."""
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
    read_mex,
)

DEFAULT_PIXEL_SIZE = 0.2125  # microns/px
QC_COLUMNS = [
    "transcript_counts", "control_probe_counts", "control_codeword_counts",
    "total_counts", "cell_area", "nucleus_area",
]


def _pixel_size(folder: Path, override: float | None) -> float:
    """Microns per pixel: `override` if given, else `pixel_size` from experiment.xenium, else the default."""
    if override is not None:
        return override
    meta = folder / "experiment.xenium"
    if meta.exists():
        data = json.loads(meta.read_text())
        if "pixel_size" in data:
            return float(data["pixel_size"])
    print(f"no pixel_size in metadata; using default {DEFAULT_PIXEL_SIZE} um/px")
    return DEFAULT_PIXEL_SIZE


def _cells(folder: Path) -> pd.DataFrame:
    """Read the per-cell table (cells.parquet or cells.csv.gz), indexed by `cell_id`."""
    if (folder / "cells.parquet").exists():
        df = pd.read_parquet(folder / "cells.parquet")
    elif (folder / "cells.csv.gz").exists():
        df = pd.read_csv(folder / "cells.csv.gz")
    else:
        fail(f"missing cells.parquet / cells.csv.gz in {folder}")
    if "cell_id" not in df.columns:
        fail(f"cells table has no 'cell_id' column; found {list(df.columns)}")
    df.index = as_str_index(df["cell_id"])
    return df


def _expression(folder: Path) -> FeatureGroup:
    """Read the gene-expression matrix (cell_feature_matrix/ MEX or .h5) as a feature group."""
    mex = folder / "cell_feature_matrix"
    if mex.is_dir():
        counts, ftype = read_mex(mex)
    elif (folder / "cell_feature_matrix.h5").exists():
        counts, ftype = read_10x_h5(folder / "cell_feature_matrix.h5")
    else:
        fail(f"missing cell_feature_matrix(/.h5) in {folder}")
    return expression_group(counts, ftype)


def _image(folder: Path) -> Path | None:
    """Locate the morphology image (from experiment.xenium, else a known filename), or None."""
    meta = folder / "experiment.xenium"
    if meta.exists():
        rel = json.loads(meta.read_text()).get("images", {}).get("morphology_focus_filepath")
        if rel and (folder / rel).exists():
            return folder / rel
    for cand in ("morphology_focus.ome.tif", "morphology_mip.ome.tif"):
        if (folder / cand).exists():
            return folder / cand
    return None


def read(args: Namespace) -> SpatialSample:
    """Read a 10x Xenium output directory into a `SpatialSample`.

    Coordinates are the cell centroids (microns) converted to image pixels via the
    pixel size; feature groups are gene expression, 10x clusters (if present) and QC
    metrics; the morphology image is used as the background when available.
    """
    folder = args.folder
    if not folder or not folder.is_dir():
        fail("xenium format requires --folder pointing at a Xenium output directory")

    pixel_size = _pixel_size(folder, args.pixel_size)
    cells = _cells(folder)
    coords = pd.DataFrame(
        {"x": cells["x_centroid"] / pixel_size, "y": cells["y_centroid"] / pixel_size},
        index=cells.index,
    )

    features = [_expression(folder)]
    clusters = read_10x_clusters(folder / "analysis")
    if clusters is not None:
        features.append(clusters)
    qc_cols = [c for c in QC_COLUMNS if c in cells.columns]
    if qc_cols:
        features.append(FeatureGroup("QC metrics", cells[qc_cols].copy(), data_type="quantitative"))

    return SpatialSample(
        coords=coords,
        mpp=pixel_size * 1e-6,
        coords_name="cells",
        spot_size=10e-6,
        features=features,
        image=_image(folder),
        channels=["DAPI"],
    )
