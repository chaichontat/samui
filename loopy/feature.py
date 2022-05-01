# pyright: reportMissingTypeArgument=false, reportUnknownParameterType=false

import gzip
import json
from typing import Any, Literal

import numpy as np
from anndata import AnnData
from scipy.sparse import csc_matrix, csr_matrix

from .utils import ReadonlyModel, Url


class PlainJSONParams(ReadonlyModel):
    type: Literal["plainJSON"] = "plainJSON"
    name: str
    url: Url
    isFeature: bool = True
    dataType: Literal["categorical", "quantitative", "coords"] = "quantitative"


class ChunkedJSONParams(ReadonlyModel):
    type: Literal["chunkedJSON"] = "chunkedJSON"
    name: str
    url: Url
    headerUrl: Url
    isFeature: bool = True
    dataType: Literal["categorical", "quantitative", "coords"] = "quantitative"


class ChunkedJSONHeader(ReadonlyModel):
    names: dict[str, int] | None = None
    ptr: list[int]
    length: int
    activeDefault: str | None = None
    sparseMode: Literal["record", "array"] | None = None


FeatureParams = ChunkedJSONParams | PlainJSONParams


def chunk(objs: list[Any]) -> tuple[np.ndarray, bytearray]:
    ptr = np.zeros(len(objs) + 1, dtype=int)
    curr = 0
    outbytes = bytearray()
    for i, o in enumerate(objs):
        if o is not None:
            comped = gzip.compress(json.dumps(o).encode())
            outbytes += comped
            curr += len(comped)
        ptr[i + 1] = curr
    return ptr, outbytes


def get_compressed_genes(
    vis: AnnData, mode: Literal["csr", "csc"] = "csc", include_name: bool = True
) -> tuple[ChunkedJSONHeader, bytearray]:
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

    # if mode == "csr":
    #     objs = [
    #         None if o is None else {vis.var_names[i]: v for i, v in zip(o["index"], o["value"])} for o in objs
    #     ]

    # if mode == "csc":
    names = {name: i for i, name in enumerate(names)}

    ptr, outbytes = chunk(objs)

    match mode:
        case "csr":
            length = cs.shape[1]
        case "csc":
            length = cs.shape[0]
        case _:
            raise ValueError("Unknown mode")

    return (
        ChunkedJSONHeader(
            names=names,
            ptr=ptr.tolist(),
            length=length,
            sparseMode="array" if mode == "csc" else "record",
        ),
        outbytes,
    )
