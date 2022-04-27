import gzip
import json
from typing import Literal

import numpy as np
from anndata import AnnData
from scipy.sparse import csc_matrix, csr_matrix

from .utils import ReadonlyModel, Url


class PlainJSONParams(ReadonlyModel):
    name: str
    url: Url
    dataType: Literal["categorical", "quantitative", "coords"] = "quantitative"
    type: Literal["plainJSON"] = "plainJSON"


class ChunkedJSONOptions(ReadonlyModel):
    densify: bool = True


class ChunkedJSONParams(ReadonlyModel):
    type: Literal["chunkedJSON"] = "chunkedJSON"
    name: str
    url: Url
    headerUrl: Url
    dataType: Literal["categorical", "quantitative", "coords"] = "quantitative"
    options: ChunkedJSONOptions = ChunkedJSONOptions()


class ChunkedJSONHeader(ReadonlyModel):
    names: dict[str, int] | None = None
    ptr: list[int]
    length: int


FeatureParams = ChunkedJSONParams | PlainJSONParams


def chunk_compressed(
    indices: np.ndarray, indptr: np.ndarray, data: np.ndarray
) -> tuple[np.ndarray, bytearray]:
    ptr = np.zeros_like(indptr)
    curr = 0
    outbytes = bytearray()

    for i in range(len(indptr) - 1):
        if (indices[indptr[i] : indptr[i + 1]]).size == 0:
            ptr[i + 1] = curr
            continue
        obj = {
            "index": indices[indptr[i] : indptr[i + 1]].tolist(),
            "value": data[indptr[i] : indptr[i + 1]].tolist(),
        }
        obj = gzip.compress(json.dumps(obj).encode())

        outbytes += obj
        curr += len(obj)
        ptr[i + 1] = curr

    return ptr, outbytes


def get_compressed_genes(
    vis: AnnData, mode: Literal["csr", "csc"] = "csc", include_name: bool = True
) -> tuple[ChunkedJSONHeader, bytearray]:
    if mode == "csr":
        cs = csr_matrix(vis.X)
        names = vis.obs_names
    elif mode == "csc":
        cs = csc_matrix(vis.X)
        names = vis.var_names
    else:
        raise ValueError("Invalid mode")

    indices = cs.indices.astype(int)
    indptr = cs.indptr.astype(int)
    data = cs.data

    ptr, outbytes = chunk_compressed(indices, indptr, data)

    match mode:
        case "csr":
            length = cs.shape[1]
        case "csc":
            length = cs.shape[0]
        case _:
            raise ValueError("Unknown mode")

    names = {name: i for i, name in enumerate(names)} if include_name else None
    return (
        ChunkedJSONHeader(
            names=names,
            ptr=ptr.tolist(),
            length=length,
        ),
        outbytes,
    )
