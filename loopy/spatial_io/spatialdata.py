"""SpatialData (.zarr / .zarr.zip) reader.

A SpatialData store bundles images, labels, shapes, points and one or more
AnnData tables in a single Zarr group. We export the single (or first) table as
the observation set: expression from ``X``, categorical ``obs`` as annotations,
and per-observation coordinates from either the table's ``obsm['spatial']`` or
the centroids of the matching ``shapes`` element joined on the table's
instance key.

Coordinates live in the element's coordinate system (microns for the test
stores), so ``mpp`` defaults to 1e-6 m/px unless ``--pixel_size`` overrides it.

Image export is out of scope here: SpatialData images are multiscale dask
arrays, so writing them to TIFF (a future extension) would mean rasterizing a
chosen scale/coordinate-system. ``image`` is left None for now.
"""
from __future__ import annotations

import tempfile
import zipfile
from argparse import Namespace
from contextlib import contextmanager
from pathlib import Path
from typing import TYPE_CHECKING, Generator

import numpy as np
import pandas as pd

from .common import (
    FeatureGroup,
    SpatialSample,
    anndata_to_sample,
    as_str_index,
    expression_group,
    fail,
)

if TYPE_CHECKING:
    import anndata
    import spatialdata as sd

DEFAULT_MPP = 1e-6  # meters/px when no pixel_size is given (coords assumed in microns)
DEFAULT_SPOT_SIZE = 1e-5  # marker diameter in meters


@contextmanager
def _opened_store(path: Path) -> Generator[Path, None, None]:
    """Yield a directory path that ``sd.read_zarr`` can open.

    A ``.zarr`` directory is used in place; a ``.zarr.zip`` is extracted to a
    temporary directory first (read_zarr expects a directory store).
    """
    if path.is_dir():
        yield path
        return
    if path.suffix == ".zip" or zipfile.is_zipfile(path):
        with tempfile.TemporaryDirectory() as tmp:
            with zipfile.ZipFile(path) as zf:
                zf.extractall(tmp)
            extracted = Path(tmp)
            # Zips may wrap the store in a single top-level directory.
            entries = [p for p in extracted.iterdir() if not p.name.startswith(".")]
            if len(entries) == 1 and entries[0].is_dir():
                extracted = entries[0]
            yield extracted
        return
    fail(f"spatialdata format requires a .zarr directory or .zarr.zip file; got {path}")


def _read_zarr_sanitized(store: Path) -> "sd.SpatialData":
    """Read a store whose table keys violate spatialdata's naming rules.

    spatialdata >=0.7 validates element/column names at ``SpatialData``
    construction, rejecting otherwise-valid stores whose ``obs``/``var`` names
    contain characters outside ``[A-Za-z0-9_.-]`` (e.g. 'µm', '^2', 'a/b').
    Read the non-table elements normally, then attach each table after
    running it through spatialdata's own sanitizer, which replaces invalid
    characters with underscores (and de-duplicates any resulting collisions).
    """
    import anndata as ad
    import spatialdata as sd

    sdata = sd.read_zarr(store, selection=("images", "labels", "points", "shapes"))
    tables_dir = store / "tables"
    if tables_dir.is_dir():
        for table_dir in sorted(p for p in tables_dir.iterdir() if p.is_dir()):
            table = ad.read_zarr(table_dir)
            sd.sanitize_table(table, inplace=True)
            sdata.tables[table_dir.name] = table
    return sdata


def _coords_from_shapes(sdata: "sd.SpatialData", table: "anndata.AnnData") -> pd.DataFrame | None:
    """Centroids of the table's region shapes, indexed by the instance key."""
    attrs = table.uns.get("spatialdata_attrs", {})
    region = attrs.get("region")
    instance_key = attrs.get("instance_key")
    if not region or not instance_key or instance_key not in table.obs:
        return None
    regions = [region] if isinstance(region, str) else list(region)
    shape_names = [r for r in regions if r in sdata.shapes]
    if not shape_names:
        return None

    geoms = pd.concat([sdata.shapes[r].geometry for r in shape_names])
    centroids = geoms.centroid
    by_instance = pd.Series(
        {str(i): (g.x, g.y) for i, g in zip(centroids.index, centroids)}
    )

    instances = as_str_index(table.obs[instance_key])
    missing = instances.difference(by_instance.index)
    if len(missing):
        fail(
            f"{len(missing)} table observations have no matching shape in "
            f"{shape_names}; cannot place them"
        )
    xy = np.array([by_instance[i] for i in instances])
    return pd.DataFrame({"x": xy[:, 0], "y": xy[:, 1]}, index=instances)


def read(args: Namespace) -> SpatialSample:
    """Read a SpatialData `.zarr` / `.zarr.zip` store into a `SpatialSample`.

    Exports the single (or first) AnnData table: expression from `X`, categorical
    `obs` as annotations, and coordinates from the table's `obsm['spatial']` or, if
    absent, the centroids of the matching `shapes` element joined on the instance key.
    Images are not exported (see the module docstring).
    """
    import spatialdata as sd
    from spatialdata._core.validation import ValidationError

    path = Path(args.zarr)
    mpp = (args.pixel_size * 1e-6) if args.pixel_size else DEFAULT_MPP
    spot_size = args.spot_size or DEFAULT_SPOT_SIZE

    with _opened_store(path) as store:
        try:
            sdata = sd.read_zarr(store)
        except ValidationError:
            sdata = _read_zarr_sanitized(store)

        if not sdata.tables:
            fail(f"SpatialData store {path} has no tables; nothing to export")
        table_key, table = next(iter(sdata.tables.items()))
        region = table.uns.get("spatialdata_attrs", {}).get("region")
        coords_name = region if isinstance(region, str) else table_key

        if "spatial" in table.obsm:
            return anndata_to_sample(
                table, mpp=mpp, coords_name=coords_name, spot_size=spot_size
            )

        coords = _coords_from_shapes(sdata, table)
        if coords is None:
            fail(
                "table has no obsm['spatial'] and no matching shapes element; "
                "labels-based centroid fallback is not implemented"
            )

        obs_ids = coords.index
        mat = table.X
        if hasattr(mat, "toarray"):
            mat = mat.toarray()
        expr = pd.DataFrame(np.asarray(mat), index=obs_ids, columns=as_str_index(table.var_names))
        groups = [expression_group(expr, None)]

        cat = [c for c in table.obs.columns if str(table.obs[c].dtype) in ("category", "object")]
        if cat:
            ann = table.obs[cat].astype(str)
            ann.index = obs_ids
            groups.append(FeatureGroup("Annotations", ann, data_type="categorical"))

        return SpatialSample(
            coords=coords,
            mpp=mpp,
            coords_name=coords_name,
            spot_size=spot_size,
            features=groups,
        )
