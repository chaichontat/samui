"""Format registry and auto-detection for the spatial-platform readers.

Each format module exposes `read(args) -> SpatialSample`. `get_reader` imports the
module lazily so heavy per-format dependencies are only pulled when used.
"""
from __future__ import annotations

import importlib
from argparse import Namespace
from pathlib import Path
from typing import Callable

from .common import SpatialSample  # re-exported for readers

FORMATS = (
    "xenium",
    "visium",
    "visium_hd",
    "cosmx",
    "spatialdata",
    "files",
)


def get_reader(fmt: str) -> Callable[[Namespace], SpatialSample]:
    """Return the `read` function of the module handling `fmt`.

    The module is imported lazily so a format's heavy optional dependencies
    (e.g. `spatialdata`) are only pulled in when that format is actually used.
    """
    if fmt not in FORMATS:
        raise SystemExit(f"unknown --format '{fmt}'; choices: {', '.join(FORMATS)}, auto")
    return importlib.import_module(f"loopy.spatial_io.{fmt}").read


def detect_format(folder: Path) -> str:
    """Sniff a folder for a platform signature. Raises if nothing matches.

    Space Ranger nests its outputs under `outs/`; if the given folder is just a
    wrapper around `outs/`, sniff that instead.
    """
    if (folder / "outs").is_dir() and not (folder / "spatial").is_dir():
        only = [p.name for p in folder.iterdir() if not p.name.startswith(".")]
        if only == ["outs"]:
            folder = folder / "outs"

    names = {p.name for p in folder.iterdir()}

    def has_glob(pat: str) -> bool:
        return any(folder.glob(pat))

    if "experiment.xenium" in names or (
        "cell_feature_matrix" in names and ("cells.parquet" in names or "cells.csv.gz" in names)
    ):
        return "xenium"
    if "binned_outputs" in names or "segmented_outputs" in names or has_glob("square_0*um"):
        return "visium_hd"
    if "spatial" in names and (folder / "spatial").is_dir() and (
        (folder / "spatial" / "tissue_positions.csv").exists()
        or (folder / "spatial" / "tissue_positions_list.csv").exists()
    ):
        return "visium"
    if has_glob("*_exprMat_file.csv") or has_glob("*exprMat*.csv"):
        return "cosmx"
    raise SystemExit(
        f"could not auto-detect a spatial platform under {folder}. "
        f"Pass --format explicitly (one of: {', '.join(FORMATS)})."
    )
