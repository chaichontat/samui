"""CosMx SMI (NanoString / Bruker) flat-file reader. Coordinates in global mosaic pixels.

Observations are cells, identified by the (fov, cell_ID) pair; cell_ID 0 marks
background and is dropped. The same composite "{fov}_{cell_ID}" id keys both the
expression matrix and the per-cell metadata, so the two tables join on it.
"""
from __future__ import annotations

from argparse import Namespace
from pathlib import Path

import pandas as pd

from .common import FeatureGroup, SpatialSample, as_str_index, expression_group, fail

# CosMx SMI imaging pixel size; the legacy flat-file export carries no calibration.
DEFAULT_PIXEL_SIZE = 0.12028  # microns/px
# Column-name aliases across export vintages (legacy lowercases fov / mixed-cases cell_ID).
FOV_ALIASES = ("fov", "FOV", "Fov")
CELL_ALIASES = ("cell_ID", "cell_id", "cellID", "CellId", "Cell_ID")
X_ALIASES = ("CenterX_global_px", "CenterX_global", "x_global_px")
Y_ALIASES = ("CenterY_global_px", "CenterY_global", "y_global_px")


def _one(folder: Path, pattern: str) -> Path | None:
    """Return the first file in `folder` matching `pattern` (sorted), or None."""
    hits = sorted(folder.glob(pattern))
    return hits[0] if hits else None


def _pick(df: pd.DataFrame, aliases: tuple[str, ...], what: str) -> str:
    """Return the first of `aliases` present as a column, or fail naming `what`."""
    for name in aliases:
        if name in df.columns:
            return name
    fail(f"no {what} column (tried {aliases}); found {list(df.columns)}")


def _composite_id(df: pd.DataFrame, fov_col: str, cell_col: str) -> pd.Index:
    """Build the unique observation id `{fov}_{cell_ID}` for each row."""
    return as_str_index(df[fov_col].astype(str) + "_" + df[cell_col].astype(str))


def read(args: Namespace) -> SpatialSample:
    """Read a CosMx SMI flat-file export into a `SpatialSample`.

    Observations are cells keyed by `{fov}_{cell_ID}` (background cell_ID 0 dropped);
    coordinates are the global-pixel centroids, feature groups are gene expression
    (control probes filtered by name) and any numeric per-cell metrics.
    """
    folder = args.folder
    if not folder or not folder.is_dir():
        fail("cosmx format requires --folder pointing at a CosMx SMI flat-file export")
    expr_file = _one(folder, "*_exprMat_file.csv")
    meta_file = _one(folder, "*_metadata_file.csv")
    if expr_file is None or meta_file is None:
        fail(f"missing *_exprMat_file.csv / *_metadata_file.csv in {folder}")

    expr = pd.read_csv(expr_file)
    e_fov = _pick(expr, FOV_ALIASES, "fov")
    e_cell = _pick(expr, CELL_ALIASES, "cell id")
    expr = expr[expr[e_cell] != 0]
    expr.index = _composite_id(expr, e_fov, e_cell)
    counts = expr.drop(columns=[e_fov, e_cell])
    genes = expression_group(counts, None)  # drops NegPrb*/SystemControl* via control-name filter

    meta = pd.read_csv(meta_file)
    m_fov = _pick(meta, FOV_ALIASES, "fov")
    m_cell = _pick(meta, CELL_ALIASES, "cell id")
    m_x = _pick(meta, X_ALIASES, "global x")
    m_y = _pick(meta, Y_ALIASES, "global y")
    meta = meta[meta[m_cell] != 0]
    meta.index = _composite_id(meta, m_fov, m_cell)
    coords = pd.DataFrame({"x": meta[m_x], "y": meta[m_y]}, index=meta.index)

    features = [genes]
    metrics = meta.select_dtypes(include="number").drop(
        columns=[m_fov, m_cell, m_x, m_y], errors="ignore"
    )
    if metrics.shape[1]:
        features.append(FeatureGroup("Cell metrics", metrics, data_type="quantitative"))

    return SpatialSample(
        coords=coords,
        mpp=(args.pixel_size * 1e-6) if args.pixel_size else DEFAULT_PIXEL_SIZE * 1e-6,
        coords_name="cells",
        spot_size=args.spot_size or 10e-6,
        features=features,
    )
