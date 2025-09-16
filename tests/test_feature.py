from __future__ import annotations

import gzip
import json
from pathlib import Path
from typing import Any, List

import numpy as np
import pandas as pd
import pytest

from loopy.feature import (
    ChunkedCSVHeader,
    ChunkedCSVParams,
    FeatureAndGroup,
    compress_chunked_features,
    join_idx,
    sparse_compress_chunked_features,
)
from loopy.utils.utils import Url


def test_join_idx_merges_on_string_index() -> None:
    template = pd.DataFrame({"x": [0, 1], "y": [2, 3]}, index=pd.Index(["a", "b"], dtype=object))
    features = pd.DataFrame({"gene": [5, 7]}, index=pd.Index(["a", "b"], dtype=object))

    joined = join_idx(template, features)

    assert list(joined.columns) == ["x", "y", "gene"]
    assert joined.loc["a", "gene"] == 5
    assert joined.loc["b", "x"] == 1


def test_join_idx_requires_string_index() -> None:
    template = pd.DataFrame({"x": [0]}, index=[1])
    features = pd.DataFrame({"gene": [5]}, index=[1])

    with pytest.raises(ValueError, match="Index must be string"):
        join_idx(template, features)


def test_join_idx_rejects_duplicate_indices() -> None:
    template = pd.DataFrame({"x": [0, 1]}, index=pd.Index(["a", "a"], dtype=object))
    features = pd.DataFrame({"gene": [5, 6]}, index=pd.Index(["a", "b"], dtype=object))

    with pytest.raises(ValueError, match="duplicated"):
        join_idx(template, features)


def test_compress_chunked_features_outputs_expected_chunks() -> None:
    df = pd.DataFrame({"a": [1, 2], "b": [3, 4]})
    logs: List[str] = []

    def logger(message: str, *args: str, type_: str = "INFO") -> None:
        logs.append(message)

    header, data = compress_chunked_features(df, logger=logger)

    assert header.names == ["a", "b"]
    assert header.length == len(df)
    assert len(header.ptr) == len(df.columns) + 1
    assert logs[-1] == "Concatenating and compressing chunks"

    first = gzip.decompress(bytes(data[header.ptr[0] : header.ptr[1]])).decode()
    second = gzip.decompress(bytes(data[header.ptr[1] : header.ptr[2]])).decode()

    assert first.startswith("1,2")
    assert second.startswith("3,4")


def test_sparse_compress_chunked_features_csc_handles_empty_columns() -> None:
    df = pd.DataFrame({"a": [0, 1, 0], "b": [2, 0, 3], "c": [0, 0, 0]})
    calls: List[str] = []

    def logger(message: str, *args: str, type_: str = "INFO") -> None:
        calls.append(message)

    header, data = sparse_compress_chunked_features(df, mode="csc", logger=logger)

    assert header.names == ["a", "b", "c"]
    assert header.length == df.shape[0]
    assert header.sparseMode == "array"
    assert len(header.ptr) == len(df.columns) + 1

    # Column 'a'
    chunk_a = gzip.decompress(bytes(data[header.ptr[0] : header.ptr[1]])).decode()
    assert "index,value" in chunk_a
    assert "1,1" in chunk_a

    # Column 'c' is empty and therefore contributes no bytes
    assert header.ptr[2] == header.ptr[3]


def test_sparse_compress_chunked_features_csr_records_rows() -> None:
    df = pd.DataFrame({"a": [0, 1, 0], "b": [2, 0, 3]})

    header, data = sparse_compress_chunked_features(df, mode="csr")

    assert header.length == df.shape[1]
    assert header.sparseMode == "record"
    assert len(header.ptr) == df.shape[0] + 1

    first_row = gzip.decompress(bytes(data[header.ptr[0] : header.ptr[1]])).decode()
    assert first_row.strip().splitlines()[1] == "1,2"


def test_sparse_compress_chunked_features_rejects_unknown_mode() -> None:
    df = pd.DataFrame({"a": [0, 1]})

    with pytest.raises(ValueError, match="Invalid mode"):
        sparse_compress_chunked_features(df, mode="coo")


def test_chunked_csv_params_default_header_and_write(tmp_path: Path) -> None:
    params = ChunkedCSVParams(name="genes", url=Url("genes.csv"), coordName="spots")

    assert params.headerUrl is not None
    assert params.headerUrl.url.endswith("genes.json")

    written: List[Path] = []

    def data_writer(path: Path) -> None:
        written.append(path)

    def header_writer(path: Path) -> None:
        written.append(path)

    params.write(tmp_path, data_writer, header_writer)

    assert tmp_path / "genes.csv" in written
    assert tmp_path / "genes.json" in written


def test_chunked_csv_header_write(tmp_path: Path) -> None:
    header = ChunkedCSVHeader(names=["a"], ptr=[0, 1], length=1, sparseMode=None)
    out = tmp_path / "header.json"

    header.write(out)

    assert json.loads(out.read_text()) == json.loads(header.json())


def test_feature_and_group_equality() -> None:
    assert FeatureAndGroup(feature="X", group="A") == FeatureAndGroup(feature="X", group="A")
    assert FeatureAndGroup(feature="X", group=None) != FeatureAndGroup(feature="X", group="A")
