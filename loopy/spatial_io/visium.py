"""10x Visium (Space Ranger) reader. Coordinates in full-resolution image pixels."""
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

SPOT_DIAMETER_UM = 55.0  # a Visium spot is 55 microns across
# tissue_positions columns, in Space Ranger's fixed order
POSITION_COLUMNS = [
    "barcode", "in_tissue", "array_row", "array_col",
    "pxl_row_in_fullres", "pxl_col_in_fullres",
]


def _outs(folder: Path) -> Path:
    """Locate the directory holding spatial/ (the run dir or its outs/ subdir)."""
    if (folder / "spatial").is_dir():
        return folder
    if (folder / "outs" / "spatial").is_dir():
        return folder / "outs"
    fail(f"no spatial/ directory found in {folder} or {folder}/outs")


def _expression(outs: Path) -> FeatureGroup:
    """Read the filtered feature-barcode matrix (.h5 or MEX dir) as a feature group."""
    h5 = outs / "filtered_feature_bc_matrix.h5"
    mex = outs / "filtered_feature_bc_matrix"
    if h5.exists():
        counts, ftype = read_10x_h5(h5)
    elif mex.is_dir():
        counts, ftype = read_mex(mex)
    else:
        fail(f"missing filtered_feature_bc_matrix.h5 / filtered_feature_bc_matrix/ in {outs}")
    return expression_group(counts, ftype)


def _positions(spatial: Path) -> pd.DataFrame:
    """Read tissue_positions (parquet / headered csv / legacy list), normalized to `POSITION_COLUMNS`."""
    parquet = spatial / "tissue_positions.parquet"
    csv_headered = spatial / "tissue_positions.csv"
    csv_legacy = spatial / "tissue_positions_list.csv"
    if parquet.exists():
        df = pd.read_parquet(parquet)
    elif csv_headered.exists():
        df = pd.read_csv(csv_headered)
    elif csv_legacy.exists():
        with csv_legacy.open() as fh:
            first = fh.readline()
        header = "infer" if first.startswith("barcode") else None
        df = pd.read_csv(csv_legacy, header=header)
    else:
        fail(f"missing tissue_positions(.parquet/.csv/_list.csv) in {spatial}")

    if list(df.columns)[: len(POSITION_COLUMNS)] != POSITION_COLUMNS:
        df = df.iloc[:, : len(POSITION_COLUMNS)]
        df.columns = POSITION_COLUMNS
    return df


def _calibration(spatial: Path, override: float | None) -> float:
    """Return microns/pixel, from --pixel_size or the spot-diameter scalefactor."""
    if override is not None:
        return override
    scale_file = spatial / "scalefactors_json.json"
    if not scale_file.exists():
        fail(f"missing scalefactors_json.json in {spatial} and no --pixel_size given")
    diameter_px = json.loads(scale_file.read_text()).get("spot_diameter_fullres")
    if not diameter_px:
        fail("scalefactors_json.json has no usable spot_diameter_fullres")
    return SPOT_DIAMETER_UM / float(diameter_px)


def read(args: Namespace) -> SpatialSample:
    """Read a 10x Visium (Space Ranger) output directory into a `SpatialSample`.

    Coordinates are the in-tissue spots' full-resolution pixel positions; feature
    groups are gene expression and 10x clusters (if present). No image is attached
    (Visium's tissue image is not part of the required outputs).
    """
    folder = args.folder
    if not folder or not folder.is_dir():
        fail("visium format requires --folder pointing at a Space Ranger output directory")

    outs = _outs(folder)
    spatial = outs / "spatial"

    positions = _positions(spatial)
    positions = positions[positions["in_tissue"] == 1]
    if positions.empty:
        fail("no in-tissue spots found in tissue positions")
    coords = pd.DataFrame(
        {
            "x": positions["pxl_col_in_fullres"].astype(float).to_numpy(),
            "y": positions["pxl_row_in_fullres"].astype(float).to_numpy(),
        },
        index=as_str_index(positions["barcode"]),
    )

    microns_per_px = _calibration(spatial, args.pixel_size)

    features = [_expression(outs)]
    clusters = read_10x_clusters(outs / "analysis")
    if clusters is not None:
        features.append(clusters)

    return SpatialSample(
        coords=coords,
        mpp=microns_per_px * 1e-6,
        coords_name="spots",
        spot_size=SPOT_DIAMETER_UM * 1e-6,
        features=features,
        image=None,
        channels=None,
    )
