"""Individual-file mode: image + cell annotations (obs) + feature annotations (var)
+ cell-feature annotations (the expression matrix X), joined by observation id.

Coordinates live in the cell-annotations table. This is the AnnData decomposition
expressed as separate files; the SpatialData reader reuses the same shape in memory.
"""
from __future__ import annotations

from argparse import Namespace
from pathlib import Path

import pandas as pd

from .common import (
    FeatureGroup,
    SpatialSample,
    as_str_index,
    drop_control_columns,
    expression_group,
    fail,
    read_10x_h5,
    read_mex,
)

ID_ALIASES = ("id", "cell_id", "barcode", "cell", "obs", "observation_id")
X_ALIASES = ("x", "x_centroid", "center_x", "px_x", "pxl_col_in_fullres")
Y_ALIASES = ("y", "y_centroid", "center_y", "px_y", "pxl_row_in_fullres")


def _read_table(path: Path) -> pd.DataFrame:
    """Read a CSV or Parquet table into a DataFrame."""
    if path.suffix == ".parquet":
        return pd.read_parquet(path)
    return pd.read_csv(path)


def _pick(cols: dict[str, str], aliases: tuple[str, ...]) -> str | None:
    """Map the first matching lowercase alias to its original column name, or None."""
    for a in aliases:
        if a in cols:
            return cols[a]
    return None


def _read_cells(path: Path) -> tuple[pd.DataFrame, list[FeatureGroup]]:
    """Read the cell table into coordinates plus overlay groups.

    Picks an id column (or uses the row number), x/y coordinate columns (accepting
    the aliases in `X_ALIASES`/`Y_ALIASES`), and turns the remaining columns into a
    categorical Annotations group (text) and a quantitative Cell metrics group (numeric).
    """
    df = _read_table(path)
    cols = {c.lower(): c for c in df.columns}
    id_col = _pick(cols, ID_ALIASES)
    if id_col is not None:
        df = df.set_index(id_col)
    df.index = as_str_index(df.index)

    xcol, ycol = _pick(cols, X_ALIASES), _pick(cols, Y_ALIASES)
    if not xcol or not ycol:
        fail(f"cell-annotations file {path} needs x/y columns; found {list(df.columns)}")
    coords = pd.DataFrame({"x": df[xcol], "y": df[ycol]}, index=df.index)

    rest = df.drop(columns=[xcol, ycol])
    groups = []
    cat = rest.select_dtypes(exclude="number")
    if cat.shape[1]:
        groups.append(FeatureGroup("Annotations", cat.astype(str), data_type="categorical"))
    num = rest.select_dtypes(include="number")
    if num.shape[1]:
        groups.append(FeatureGroup("Cell metrics", num, data_type="quantitative"))
    return coords, groups


def _read_matrix(path: Path, obs_index: pd.Index) -> pd.DataFrame:
    """Read the expression matrix as observations x features.

    Accepts a MEX directory, a 10x `.h5`, or a CSV/Parquet table; for the tabular
    forms the orientation is detected by matching either axis against `obs_index`,
    so a transposed (features x observations) matrix is handled.
    """
    if path.is_dir():
        counts, _ = read_mex(path)
        return counts
    if path.suffix == ".h5":
        counts, _ = read_10x_h5(path)
        return counts
    if path.suffix == ".parquet":
        df = pd.read_parquet(path)
        df = df.set_index(df.columns[0])
    else:
        df = pd.read_csv(path, index_col=0)
    df.index = as_str_index(df.index)
    # Orient so rows are observations: pick whichever axis matches the cell ids.
    if df.index.isin(obs_index).sum() < as_str_index(df.columns).isin(obs_index).sum():
        df = df.T
        df.index = as_str_index(df.index)
    return df


def read(args: Namespace) -> SpatialSample:
    """Read the individual-file (AnnData decomposition) inputs into a `SpatialSample`.

    Joins `--cells` (coordinates + obs) with `--matrix` (expression X) by observation
    id, optionally restricting to gene features via `--features` (var) and attaching
    `--image` as the background.
    """
    if not args.cells or not args.matrix:
        fail("files format requires --cells and --matrix (and optional --image, --features)")
    coords, extra_groups = _read_cells(args.cells)
    counts = _read_matrix(args.matrix, coords.index)

    ftype = None
    if args.features:
        var = _read_table(args.features)
        var = var.set_index(var.columns[0])
        type_col = next((c for c in var.columns if "type" in c.lower()), None)
        if type_col is not None:
            ftype = var[type_col]
            ftype.index = as_str_index(var.index)
            counts.columns = as_str_index(counts.columns)
    counts = drop_control_columns(counts)
    groups = [expression_group(counts, ftype)] + extra_groups

    return SpatialSample(
        coords=coords,
        mpp=args.mpp if args.mpp is not None else 1.0,
        coords_name="cells",
        spot_size=args.spot_size if args.spot_size is not None else 1e-5,
        features=groups,
        image=args.image,
        channels=None,
    )
