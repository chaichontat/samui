# pyright: reportMissingTypeArgument=false, reportUnknownParameterType=false
import gzip
import json
from pathlib import Path
from typing import Any, Callable, Literal

import numpy as np
import pandas as pd
from pydantic import BaseModel
from typing_extensions import Self


class ReadonlyModel(BaseModel):
    class Config:
        allow_mutation = False


def remove_dupes(df: pd.DataFrame):
    return df[~df.index.duplicated(keep="first")]


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
