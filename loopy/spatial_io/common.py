"""Shared building blocks for the spatial-platform readers.

Every reader turns a platform's files into one `SpatialSample`: a coordinate
table keyed by a unique string observation id, zero or more named feature groups
(expression / annotations / QC) keyed by that same id, and an optional image with
its calibration. `build_sample` then turns that into a loopy Sample. The readers
differ only in *where the bytes live and what units they are in*; the matrix
decoders, control-feature filtering and id handling below are common to several
platforms, so they live here rather than being re-implemented per platform.
"""
from __future__ import annotations

import gzip
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import TYPE_CHECKING, NoReturn

import numpy as np
import pandas as pd
from scipy.io import mmread

if TYPE_CHECKING:
    import anndata

GENE_EXPRESSION = "Gene Expression"
# Control / background feature markers to drop when a feature-type column is absent
# (Xenium carries a feature-type column; CosMx names its controls by prefix instead).
CONTROL_NAME_PREFIXES = ("NegPrb", "NegControl", "SystemControl", "Blank-", "BLANK_", "blank-")


@dataclass
class FeatureGroup:
    """One overlay group in Samui (a chunked feature)."""

    name: str
    df: pd.DataFrame  # observations (rows, str index) x features (columns)
    data_type: str = "quantitative"  # or "categorical"
    sparse: bool = False
    unit: str | None = None


@dataclass
class SpatialSample:
    """Platform-agnostic intermediate consumed by `build_sample`."""

    coords: pd.DataFrame  # str index = observation id; columns x, y (pixels)
    mpp: float  # meters per pixel, applied to coords and image
    coords_name: str = "cells"
    spot_size: float = 1e-5  # marker diameter in meters
    features: list[FeatureGroup] = field(default_factory=list)
    image: Path | None = None
    channels: list[str] | None = None
    default_feature: tuple[str, str] | None = None  # (group, feature)


def fail(msg: str) -> NoReturn:
    """Abort the run with `msg` as the process exit message (non-zero status)."""
    sys.exit(msg)


def as_str_index(obj: pd.Index | pd.Series | list) -> pd.Index:
    """Coerce ids to a string-typed pandas Index (loopy requires string ids)."""
    return pd.Index(obj).astype(str)


def is_control_feature(name: str) -> bool:
    """True if `name` is a negative/background probe (see `CONTROL_NAME_PREFIXES`)."""
    return any(name.startswith(p) for p in CONTROL_NAME_PREFIXES)


def drop_control_columns(df: pd.DataFrame) -> pd.DataFrame:
    """Drop columns whose name marks a negative/background probe."""
    keep = [c for c in df.columns if not is_control_feature(str(c))]
    return df[keep]


def read_mex(mex_dir: Path) -> tuple[pd.DataFrame, pd.Series]:
    """Read a gzipped MatrixMarket triplet (features x cells) into obs x features.

    Returns (counts, feature_types) where counts is observations x genes and
    feature_types is a per-gene Series (the third features.tsv column, or NaN).
    """
    matrix = mex_dir / "matrix.mtx.gz"
    features_file = mex_dir / "features.tsv.gz"
    barcodes_file = mex_dir / "barcodes.tsv.gz"
    for f in (matrix, features_file, barcodes_file):
        if not f.exists():
            fail(f"missing {f}")

    features = pd.read_csv(features_file, sep="\t", header=None)
    symbols = features[1] if features.shape[1] > 1 else features[0]
    ftype = features[2] if features.shape[1] > 2 else pd.Series([np.nan] * len(features))
    barcodes = pd.read_csv(barcodes_file, sep="\t", header=None)[0]

    with gzip.open(matrix, "rb") as fh:
        counts = mmread(fh).tocsc()  # features x cells (kept sparse)

    # Sparse-backed frame (observations x features); densifying here would blow up
    # for large panels (see read_10x_h5).
    df = pd.DataFrame.sparse.from_spmatrix(
        counts.T.tocsc(), index=as_str_index(barcodes), columns=list(symbols)
    )
    ftype.index = list(symbols)
    return df, ftype


def read_10x_h5(path: Path) -> tuple[pd.DataFrame, pd.Series]:
    """Read a 10x CSC HDF5 matrix (/matrix, features x cells) into obs x features.

    Returned as a sparse-backed DataFrame: densifying here would need tens of GB for
    large panels (e.g. Xenium Prime, ~9.5k genes x ~400k cells), so the matrix stays
    sparse all the way through `expression_group` and loopy's chunked-feature writer.
    """
    import h5py
    from scipy.sparse import csc_matrix

    with h5py.File(path, "r") as f:
        g = f["matrix"]
        data, indices, indptr = g["data"][:], g["indices"][:], g["indptr"][:]
        shape = tuple(g["shape"][:])  # (n_features, n_obs)
        mat = csc_matrix((data, indices, indptr), shape=shape)  # features x obs
        barcodes = [b.decode() if isinstance(b, bytes) else str(b) for b in g["barcodes"][:]]
        names = [n.decode() if isinstance(n, bytes) else str(n) for n in g["features"]["name"][:]]
        ftype_raw = g["features"].get("feature_type")
        ftype = (
            [t.decode() if isinstance(t, bytes) else str(t) for t in ftype_raw[:]]
            if ftype_raw is not None
            else [np.nan] * len(names)
        )

    df = pd.DataFrame.sparse.from_spmatrix(mat.T.tocsc(), index=as_str_index(barcodes), columns=names)
    return df, pd.Series(ftype, index=names)


def expression_group(
    counts: pd.DataFrame,
    feature_types: pd.Series | None,
    *,
    name: str = "Gene expression",
    unit: str = "counts",
) -> FeatureGroup:
    """Filter to biological genes and wrap as a sparse quantitative feature group."""
    if feature_types is not None and feature_types.notna().any():
        genes = feature_types.index[feature_types == GENE_EXPRESSION]
        counts = counts.loc[:, counts.columns.isin(genes)]
    counts = drop_control_columns(counts)
    counts = counts.loc[:, ~counts.columns.duplicated()]
    return FeatureGroup(name=name, df=counts, data_type="quantitative", sparse=True, unit=unit)


def read_10x_clusters(analysis_dir: Path) -> "FeatureGroup | None":
    """Collect 10x `analysis/clustering/*/clusters.csv` into one categorical group.

    Shared by Xenium / Visium / Visium HD, whose clustering dirs are named
    `graphclust` / `kmeans_N_clusters` (Xenium prefixes them `gene_expression_`).
    """
    clustering = analysis_dir / "clustering"
    if not clustering.is_dir():
        return None
    cols = {}
    for sub in sorted(clustering.iterdir()):
        csv = sub / "clusters.csv"
        if not csv.exists():
            continue
        name = sub.name.removeprefix("gene_expression_").removesuffix("_clusters")
        df = pd.read_csv(csv)
        cols[name] = pd.Series(df["Cluster"].astype(str).to_numpy(), index=as_str_index(df["Barcode"]))
    if not cols:
        return None
    return FeatureGroup("Clusters", pd.DataFrame(cols), data_type="categorical")


def read_anndata(path: Path) -> "anndata.AnnData":
    """Read an `.h5ad` file into an AnnData (imported lazily to keep it optional)."""
    import anndata as ad

    return ad.read_h5ad(path)


def anndata_to_sample(
    adata: "anndata.AnnData",
    *,
    mpp: float,
    coords_name: str,
    spot_size: float,
    spatial_key: str = "spatial",
) -> SpatialSample:
    """Convert an AnnData table to a `SpatialSample` (used by the SpatialData reader).

    Coordinates come from `obsm[spatial_key]` (first two columns), expression from
    `X` (filtered to genes and wrapped as one sparse quantitative group), and the
    categorical/object `obs` columns become a single categorical Annotations group.
    """
    obs_ids = as_str_index(adata.obs_names)
    if spatial_key not in adata.obsm:
        fail(f"AnnData has no obsm['{spatial_key}']; cannot place observations")
    xy = np.asarray(adata.obsm[spatial_key])[:, :2]
    coords = pd.DataFrame({"x": xy[:, 0], "y": xy[:, 1]}, index=obs_ids)

    # Keep a sparse X sparse-backed (see read_10x_h5); a dense X stays dense.
    var_names = as_str_index(adata.var_names)
    X = adata.X
    if hasattr(X, "toarray"):  # scipy sparse
        expr = pd.DataFrame.sparse.from_spmatrix(X, index=obs_ids, columns=var_names)
    else:
        expr = pd.DataFrame(np.asarray(X), index=obs_ids, columns=var_names)
    groups = [expression_group(expr, None)]

    cat = [c for c in adata.obs.columns if str(adata.obs[c].dtype) in ("category", "object")]
    if cat:
        ann = adata.obs[cat].astype(str)
        ann.index = obs_ids
        groups.append(FeatureGroup("Annotations", ann, data_type="categorical"))

    return SpatialSample(coords=coords, mpp=mpp, coords_name=coords_name, spot_size=spot_size, features=groups)
