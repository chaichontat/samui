from typing import Literal

import pandas as pd
from anndata import AnnData
from scipy.sparse import csc_matrix, csr_matrix

from .utils import ReadonlyModel, Url, concat

FeatureType = Literal["categorical", "quantitative", "singular"]


class Coord(ReadonlyModel):
    x: int
    y: int


class CoordId(Coord):
    id: str


class CoordParams(ReadonlyModel):
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
    mPerPx: float | None = None
    size: float | None = None


class PlainCSVParams(ReadonlyModel):
    type: Literal["plainCSV"] = "plainCSV"
    name: str
    url: Url
    dataType: FeatureType = "quantitative"
    coordName: str | None = None
    unit: str | None = None
    size: float | None = None


class ChunkedCSVParams(ReadonlyModel):
    type: Literal["chunkedCSV"] = "chunkedCSV"
    name: str
    url: Url
    headerUrl: Url
    dataType: FeatureType = "quantitative"
    unit: str | None = None


class ChunkedCSVHeader(ReadonlyModel):
    names: list[str] | None = None
    ptr: list[int]
    length: int
    activeDefault: str | None = None
    sparseMode: Literal["record", "array"] | None = None
    coordName: str | None = None


class FeatureAndGroup(ReadonlyModel):
    feature: str
    group: str | None = None


FeatureParams = ChunkedCSVParams | PlainCSVParams


def get_compressed_genes(
    vis: AnnData, coordName: str, mode: Literal["csr", "csc"] = "csc"
) -> tuple[ChunkedCSVHeader, bytearray]:
    if mode == "csr":
        cs = csr_matrix(vis.X)  # csR
    elif mode == "csc":
        cs = csc_matrix(vis.X)  # csC
    else:
        raise ValueError("Invalid mode")

    names = vis.var_names

    indices = cs.indices.astype(int)
    indptr = cs.indptr.astype(int)
    data = cs.data

    objs = []

    for i in range(len(indptr) - 1):
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
            )

    ptr, outbytes = concat(objs, lambda x: x.to_csv(index=False).encode())
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
