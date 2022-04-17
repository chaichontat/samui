import gzip
import json
from pathlib import Path

import numpy as np
import scanpy as sc
from anndata import AnnData
from pydantic import BaseModel
from scipy.sparse import csc_matrix


class GeneHeader(BaseModel):
    n_spot: int
    names: dict[str, int]
    ptr: list[int]


def get_compressed_genes(vis: AnnData):
    cs = csc_matrix(vis.X)
    indices = cs.indices.astype(int)
    indptr = cs.indptr.astype(int)
    data = cs.data

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

    header = GeneHeader(
        n_spot=vis.n_obs,
        names={name: i for i, name in enumerate(vis.var_names)},
        ptr=ptr.tolist(),
    )

    return header, outbytes


# def run():

#     Path("./header.json").write_text(json.dumps(header, separators=(",", ":")))

#     with open("./Counts_Br6522_Ant_IF.dump", "wb") as f:
#         f.write(outbytes)
