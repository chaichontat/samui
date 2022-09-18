
from typing import Literal

from anndata import AnnData
from scipy.sparse import csc_matrix, csr_matrix

from .utils import ReadonlyModel, Url, concat_json


class Coord(ReadonlyModel):
    x: int
    y: int


class CoordId(Coord):
    id: str


class OverlayParams(ReadonlyModel):
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
    type: Literal["single", "multi"] = "single"
    shape: Literal["circle"]
    url: Url
    mPerPx: float | None = None
    size: float | None = None

class PlainJSONParams(ReadonlyModel):
    type: Literal["plainJSON"] = "plainJSON"
    name: str
    url: Url
    dataType: Literal["categorical", "quantitative", "coords"] = "quantitative"
    overlay: str | None = None


class ChunkedJSONParams(ReadonlyModel):
    type: Literal["chunkedJSON"] = "chunkedJSON"
    name: str
    url: Url
    headerUrl: Url
    dataType: Literal["categorical", "quantitative", "coords"] = "quantitative"
    overlay: str | None = None


class ChunkedHeader(ReadonlyModel):
    names: dict[str, int] | None = None
    ptr: list[int]
    length: int
    dtype: Literal['json', 'csv'] = 'json'
    activeDefault: str | None = None
    sparseMode: Literal["record", "array"] | None = None


FeatureParams = ChunkedJSONParams | PlainJSONParams


def get_compressed_genes(
    vis: AnnData, mode: Literal["csr", "csc"] = "csc"
) -> tuple[ChunkedHeader, bytearray]:
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
                {
                    "index": indices[indptr[i] : indptr[i + 1]].tolist(),
                    "value": [round(x, 3) for x in data[indptr[i] : indptr[i + 1]].tolist()],
                }
            )

    names = {name: i for i, name in enumerate(names)}
    ptr, outbytes = concat_json(objs)
    match mode:
        case "csr":
            length = cs.shape[1]
        case "csc":
            length = cs.shape[0]
        case _:
            raise ValueError("Unknown mode")

    return (
        ChunkedHeader(
            names=names,
            ptr=ptr.tolist(),
            length=length,
            sparseMode="array" if mode == "csc" else "record",
        ),
        outbytes,
    )
