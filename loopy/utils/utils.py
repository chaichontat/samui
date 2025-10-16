# pyright: reportMissingTypeArgument=false, reportUnknownParameterType=false
import gzip
import hashlib
import json
from pathlib import Path
from typing import Any, Callable, Literal, Protocol, Union

import numpy as np
import pandas as pd
import requests
from pandas.api.types import is_numeric_dtype
from pydantic import BaseModel
from typing_extensions import Self

from loopy.logger import log


class ReadonlyModel(BaseModel):
    class Config:
        allow_mutation = False


def remove_dupes(df: pd.DataFrame):
    return df[~df.index.duplicated(keep="first")]


class Callback(Protocol):
    def __call__(
        self, *args: str, type_: Literal["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"] = "INFO"
    ) -> None: ...


class Url(ReadonlyModel):
    url: str
    type: Literal["local", "network"] = "local"

    def __init__(self, url: str, type: Literal["local", "network"] = "local"):
        super().__init__(url=url, type=type)  # type: ignore

    def write(self, f: Callable[[Path], None]) -> Self:
        f(Path(self.url))
        return self


class Writable(ReadonlyModel):
    url: Url

    def write(self, path: Path, f: Callable[[Path], None]) -> Self:
        f(path / Path(self.url.url))
        return self


def concat_json(objs: list[Any]) -> tuple[np.ndarray, bytearray]:
    """Concatenate a list of JSON serializable objects into a single gzipped binary
    along with pointers to the start of each object.

    Returns:
        tuple[np.ndarray, bytearray]: Pointer array and binary data
    """
    return concat(objs, lambda x: json.dumps(x).encode())


def concat_csv(objs: list[Any]) -> tuple[np.ndarray, bytearray]:
    """Concatenate a list of JSON serializable objects into a single gzipped binary
    along with pointers to the start of each object.

    Returns:
        tuple[np.ndarray, bytearray]: Pointer array and binary data
    """
    return concat(objs, lambda x: ",".join(x).encode())


def concat(objs: list[Any], f: Callable[[Any], bytes] = lambda x: x) -> tuple[np.ndarray, bytearray]:
    """Concatenate a list of JSON serializable objects into a single gzipped binary
    along with pointers to the start of each object.

    Returns:
        tuple[np.ndarray, bytearray]: Pointer array and binary data
    """
    ptr = np.zeros(len(objs) + 1, dtype=int)
    curr = 0
    outbytes = bytearray()
    for i, o in enumerate(objs):
        if o is not None:
            comped = gzip.compress(f(o))
            outbytes += comped
            curr += len(comped)
        ptr[i + 1] = curr
    return ptr, outbytes


def check_md5(path: Path, md5: str) -> bool:
    with open(path, "rb") as f:
        return hashlib.md5(f.read()).hexdigest() == md5


def download(url: str, path: Path, md5: str | None = None) -> None:
    if path.exists() and md5 is not None and check_md5(path, md5):
        log(f"Hash matches. Skipping {path}...")
        return

    log(f"Downloading {url}...")
    r = requests.get(url, stream=True)
    with open(path, "wb") as f:
        for chunk in r.iter_content(chunk_size=1024):
            if chunk:
                f.write(chunk)


def estimate_spot_diameter(
    coords: pd.DataFrame,
    *,
    m_per_px: float,
    subsample: int = 5000,
    factor: float = 0.25,
    rng: int = 0,
) -> float:
    """Estimate spot diameter in meters from coordinates using a nearest‑neighbor heuristic.

    The heuristic computes the median nearest‑neighbor distance in the input coordinate space
    and multiplies by a packing factor (default 0.55, approximating hexagonal packing) and `m_per_px`.

    Args:
        coords: DataFrame with columns 'x' and 'y' (in pixel units of the coordinate system).
        m_per_px: Meters per pixel conversion to convert distances to meters. If your coordinates
            are already in meters, pass 1.0.
        subsample: Randomly subsample at most this many points for speed when large.
        factor: Packing factor to convert center‑to‑center distance to diameter.
        rng: Seed for reproducible subsampling.

    Returns:
        Estimated spot diameter in meters.

    Raises:
        ValueError: If fewer than 2 coordinates are provided or required columns are missing.
    """
    if not {"x", "y"}.issubset(coords.columns):
        raise ValueError("coords must contain 'x' and 'y' columns")
    if len(coords) < 2:
        raise ValueError("At least two coordinates are required to estimate spot size")

    try:
        from scipy.spatial import cKDTree  # defer import to avoid hard dependency at module import
    except Exception as e:  # pragma: no cover
        raise RuntimeError("SciPy is required for spot size estimation (scipy.spatial.cKDTree)") from e

    pts = coords[["x", "y"]].to_numpy()
    if len(pts) > subsample:
        idx = np.random.default_rng(rng).choice(len(pts), subsample, replace=False)
        pts = pts[idx]
    tree = cKDTree(pts)
    dists, _ = tree.query(pts, k=2)
    nn = float(np.median(dists[:, 1]))
    return nn * factor * m_per_px


FeatureDT = Literal["quantitative", "categorical"]


def infer_feature_data_type(obj: Union[pd.DataFrame, pd.Series]) -> FeatureDT:
    """Infer feature dataType ('quantitative' or 'categorical') from pandas dtype(s).

    Rules:
    - Series: numeric → quantitative; otherwise → categorical.
    - DataFrame: if ALL columns are numeric → quantitative; else → categorical.

    Note: integer-coded categories will be treated as quantitative. If that is undesirable,
    cast your column(s) to pandas 'category' dtype before calling this function.
    """
    if isinstance(obj, pd.Series):
        return "quantitative" if is_numeric_dtype(obj.dtype) else "categorical"
    # DataFrame path
    for dt in obj.dtypes:
        if not is_numeric_dtype(dt):
            return "categorical"
    return "quantitative"


def _normalize_obsm_key(key: str) -> str:
    """Normalize an obsm key by lowercasing and dropping non-alphanumeric characters."""
    return "".join(ch for ch in key.lower() if ch.isalnum())
