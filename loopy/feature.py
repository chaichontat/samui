from pathlib import Path
from typing import Callable, Literal, cast

import pandas as pd
from pydantic import validator
from scipy.sparse import csc_matrix, csr_matrix
from typing_extensions import Self

from loopy.logger import log

from .utils.utils import Callback, ReadonlyModel, Url, Writable, concat

FeatureType = Literal["categorical", "quantitative", "singular"]


class Coord(ReadonlyModel):
    x: int
    y: int


class CoordId(Coord):
    id: str


class CoordParams(Writable):
    """
    name: Name of the overlay
    type: Type of the overlay 'single', 'multi'
    shape: Shape of the overlay (currently only circle)
    url: points to a json file with the coordinates of the overlay
        in {x: number, y: number, id?: string}[].
        or
        ChunkedHeader
    mPerPx: micrometers per pixel
    size: size of the overlay in micrometers
    """

    name: str
    shape: Literal["circle"]
    url: Url
    mPerPx: float
    size: float


class PlainCSVParams(Writable):
    type: Literal["plainCSV"] = "plainCSV"
    name: str
    url: Url
    dataType: FeatureType = "quantitative"
    coordName: str | None = None
    unit: str | None = None


class ChunkedCSVParams(Writable):
    type: Literal["chunkedCSV"] = "chunkedCSV"
    name: str
    url: Url
    coordName: str
    headerUrl: Url | None = None
    dataType: FeatureType = "quantitative"
    unit: str | None = None

    @validator("headerUrl", always=True, pre=False)
    def check_headerUrl(cls, v: Url | None, values: dict[str, str | None]):
        if v is None:
            path = Path(cast(Url, values["url"]).url)
            return Url(url=path.with_suffix(".json").as_posix())
        return v

    def write(
        self, path: Path, f: Callable[[Path], None], header: Callable[[Path], None] | None = None
    ) -> Self:
        f(path / Path(self.url.url))
        if header and self.headerUrl:
            header(path / Path(self.headerUrl.url))
        return self


class ChunkedCSVHeader(ReadonlyModel):
    names: list[str] | None = None
    ptr: list[int]
    length: int
    activeDefault: str | None = None
    sparseMode: Literal["record", "array"] | None = None
    coordName: str | None = None

    def write(self, path: Path) -> None:
        path.write_text(self.json())


class FeatureAndGroup(ReadonlyModel):
    feature: str
    group: str | None = None


FeatureParams = ChunkedCSVParams | PlainCSVParams


def join_idx(template: pd.DataFrame, feat: pd.DataFrame) -> pd.DataFrame:
    """Add index to feature dataframe and join with template

    Args:
        template (pd.DataFrame): Coords dataframe
        feat (pd.DataFrame): Feature dataframe

    Returns:
        pd.DataFrame: Joined dataframe
    """
    if "id" in template.columns:
        template = template.set_index("id")

    if "id" in feat.columns:
        feat = feat.set_index("id")

    for df in [template, feat]:
        if not df.index.dtype == "object":
            raise ValueError(
                """Index must be string. This is to prevent subtle bugs.
                Use`df.index = df.index.astype(str)` and verify that the index is unique with `df.index.is_unique`."""
            )

        if not df.index.is_unique:
            raise ValueError(
                f"Template (coords) index is not unique. {df.index[df.index.duplicated()]} duplicated"
            )

    if "x" in feat.columns or "y" in feat.columns:
        raise ValueError("Feature dataframe cannot have columns named 'x' or 'y'")

    joined = template.join(feat, validate="one_to_one").drop(columns=["x", "y"])

    # raise error if there are any NaNs
    if joined.isna().any().any():
        raise ValueError(
            f"Feature dataframe is missing values for {joined.isna().any()[joined.isna().any()].index}"
        )

    assert len(joined) == len(template)
    return joined


def compress_chunked_features(
    df: pd.DataFrame,
    coordName: str,
    mode: Literal["csr", "csc"] = "csc",
    logger: Callback = log,
) -> tuple[ChunkedCSVHeader, bytearray]:
    if mode == "csr":
        cs = csr_matrix(df)  # csR
    elif mode == "csc":
        cs = csc_matrix(df)  # csC
    else:
        raise ValueError("Invalid mode")

    names = df.columns

    indices = cs.indices.astype(int)
    indptr = cs.indptr.astype(int)
    data = cs.data

    objs = []

    for i in range(len(indptr) - 1):
        if i % 1000 == 0:
            logger(f"Processing {i} of {len(indptr) - 1} chunks")

        if (indices[indptr[i] : indptr[i + 1]]).size == 0:
            objs.append(None)
        else:
            objs.append(
                pd.DataFrame(
                    {
                        "index": indices[indptr[i] : indptr[i + 1]].tolist(),
                        "value": [round(x, 3) for x in data[indptr[i] : indptr[i + 1]].tolist()],
                    }
                )
                .to_csv(index=False)
                .encode()
            )

    logger("Concatenating and compressing chunks")
    ptr, outbytes = concat(objs)
    match mode:
        case "csr":
            length = cs.shape[1]
        case "csc":
            length = cs.shape[0]
        case _:
            raise ValueError("Unknown mode")

    return (
        ChunkedCSVHeader(
            names=names.to_list(),
            ptr=ptr.tolist(),
            length=length,
            sparseMode="array" if mode == "csc" else "record",
            coordName=coordName,
        ),
        outbytes,
    )
