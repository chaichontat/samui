"""Turn a platform-agnostic `SpatialSample` into a loopy Sample folder.

This is the glue between the readers and loopy: it drives loopy's `Sample`
(`add_coords` / `add_chunked_feature` / `add_image` / `set_default_feature` /
`write`) rather than re-implementing any of the coordinate join, chunked-feature
compression or image tiling — loopy owns those.
"""
from __future__ import annotations

import sys
from pathlib import Path

import pandas as pd

from loopy.sample import Sample

from .common import FeatureGroup, SpatialSample


def _check_overlap(fg: FeatureGroup, coord_index: pd.Index) -> None:
    """Fail (or warn) on a feature group whose ids don't line up with the coords.

    loopy's `add_chunked_feature` left-joins the feature frame onto the coordinate
    table, silently dropping feature rows with no matching observation and leaving
    NaN for observations absent from the feature. That is the behaviour we want,
    but with no overlap at all it would emit an all-NaN feature instead of an
    error, so guard that case here and warn on a partial match.
    """
    common = coord_index.intersection(fg.df.index)
    if len(common) == 0:
        sys.exit(
            f"feature group '{fg.name}': no overlap with observation ids "
            f"(obs e.g. {list(coord_index[:3])}, {fg.name} e.g. {list(fg.df.index[:3])})"
        )
    dropped = len(fg.df.index.difference(coord_index))
    if dropped:
        print(
            f"warning: feature group '{fg.name}' has {dropped} ids not in coords; "
            "loopy will drop them.",
            file=sys.stderr,
        )


def build_sample(
    s: SpatialSample,
    *,
    outdir: Path,
    name: str,
    convert_8bit: bool = False,
) -> None:
    """Write `s` as a loopy Sample folder at `outdir / name`.

    Adds the coordinate set, each non-empty feature group (loopy joins it to the
    coords and chunk-compresses it), and, if present, the background image
    (degrading to image-less on any decode/IO failure rather than aborting the
    run). Nothing is written until loopy's lazy `Sample.write()` at the end.
    """
    outdir.mkdir(parents=True, exist_ok=True)
    if s.coords.index.duplicated().any():
        sys.exit(f"duplicate observation ids in coords for sample '{name}'")

    sample = Sample(name=name, path=outdir / name)
    sample = sample.add_coords(
        s.coords[["x", "y"]], name=s.coords_name, mPerPx=s.mpp, size=s.spot_size
    )

    for fg in s.features:
        if fg.df.shape[1] == 0:
            continue
        _check_overlap(fg, s.coords.index)
        sample = sample.add_chunked_feature(
            fg.df, name=fg.name, coordName=s.coords_name,
            sparse=fg.sparse, dataType=fg.data_type, unit=fg.unit,
        )

    has_image = False
    if s.image is not None:
        try:
            sample.add_image(s.image, channels=s.channels, scale=s.mpp, convert_to_8bit=convert_8bit)
            has_image = True
        except Exception as e:  # noqa: BLE001 - any decode/IO failure should degrade, not abort
            print(f"warning: could not add image {s.image}: {e}; continuing without it.", file=sys.stderr)

    if s.default_feature:
        sample = sample.set_default_feature(group=s.default_feature[0], feature=s.default_feature[1])

    sample.write()
    n_feat = sum(g.df.shape[1] for g in s.features)
    print(
        f"Wrote sample '{name}' to {outdir / name}\n"
        f"  observations: {len(s.coords)}; feature groups: {len(s.features)} "
        f"({n_feat} features); image: {'yes' if has_image else 'no'}"
    )
