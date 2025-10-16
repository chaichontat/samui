from __future__ import annotations

import gzip
import hashlib
from pathlib import Path
from typing import Any, Iterable, List

import numpy as np
import pandas as pd
import pytest

from loopy.utils import utils


def test_remove_dupes_keeps_first_index() -> None:
    df = pd.DataFrame({"value": [1, 2, 3]}, index=["a", "a", "b"])

    result = utils.remove_dupes(df)

    assert list(result.index) == ["a", "b"]
    assert list(result["value"]) == [1, 3]


def test_concat_handles_none_entries() -> None:
    ptr, data = utils.concat([b"a", None, b"bc"])

    assert list(ptr) == [0, len(gzip.compress(b"a")), len(gzip.compress(b"a")), len(data)]
    assert gzip.decompress(bytes(data[: ptr[1]])).decode() == "a"
    assert gzip.decompress(bytes(data[ptr[2] : ptr[3]])).decode() == "bc"


def test_concat_json_and_csv_delegate_to_concat(monkeypatch: pytest.MonkeyPatch) -> None:
    collected: List[str] = []

    def fake_concat(objs: list[Any], f):
        collected.append(f.__name__ if hasattr(f, "__name__") else "lambda")
        return np.array([0, 0]), bytearray()

    monkeypatch.setattr(utils, "concat", fake_concat)

    utils.concat_json([{"a": 1}])
    utils.concat_csv([["a", "b"]])

    assert collected == ["<lambda>", "<lambda>"]


def test_check_md5(tmp_path: Path) -> None:
    path = tmp_path / "file.bin"
    data = b"hello"
    path.write_bytes(data)

    digest = hashlib.md5(data).hexdigest()

    assert utils.check_md5(path, digest)
    assert not utils.check_md5(path, "0" * 32)


def test_download_skips_when_hash_matches(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    path = tmp_path / "cached.bin"
    data = b"cached"
    path.write_bytes(data)
    digest = hashlib.md5(data).hexdigest()

    def fake_get(*args: Any, **kwargs: Any) -> None:
        raise AssertionError("download should not be attempted")

    monkeypatch.setattr(utils, "requests", type("Dummy", (), {"get": staticmethod(fake_get)}))

    logs: List[str] = []

    def fake_log(message: str, *args: str, type_: str = "INFO") -> None:
        logs.append(message)

    monkeypatch.setattr(utils, "log", fake_log)

    utils.download("http://example", path, md5=digest)

    assert logs == [f"Hash matches. Skipping {path}..."]


def test_download_streams_content(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    path = tmp_path / "download.bin"
    chunks = [b"foo", b"bar"]

    class DummyResponse:
        def iter_content(self, chunk_size: int) -> Iterable[bytes]:
            assert chunk_size == 1024
            for chunk in chunks:
                yield chunk

    def fake_get(url: str, stream: bool) -> DummyResponse:
        assert stream is True
        assert url == "http://example"
        return DummyResponse()

    monkeypatch.setattr(utils.requests, "get", fake_get)

    logs: List[str] = []

    def fake_log(message: str, *args: str, type_: str = "INFO") -> None:
        logs.append(message)

    monkeypatch.setattr(utils, "log", fake_log)

    utils.download("http://example", path)

    assert path.read_bytes() == b"foobar"
    assert logs == ["Downloading http://example..."]


def test_url_write_invokes_callback(tmp_path: Path) -> None:
    captured: List[Path] = []

    def writer(path: Path) -> None:
        captured.append(path)

    url = utils.Url("file.txt")
    url.write(writer)

    assert captured == [Path("file.txt")]


def test_writable_write_joins_root(tmp_path: Path) -> None:
    dest = tmp_path / "root"
    dest.mkdir()

    captured: List[Path] = []

    def writer(path: Path) -> None:
        captured.append(path)

    writable = utils.Writable(url=utils.Url("inner.txt"))
    writable.write(dest, writer)

    assert captured == [dest / "inner.txt"]


def test_infer_feature_data_type_series_numeric_and_string() -> None:
    s_num = pd.Series([1, 2, 3], dtype=int)
    s_str = pd.Series(["a", "b", "c"], dtype=object)

    assert utils.infer_feature_data_type(s_num) == "quantitative"
    assert utils.infer_feature_data_type(s_str) == "categorical"


def test_infer_feature_data_type_dataframe_all_numeric() -> None:
    df = pd.DataFrame({"a": [1, 2], "b": [0.1, 0.2]})
    assert utils.infer_feature_data_type(df) == "quantitative"


def test_infer_feature_data_type_dataframe_mixed_and_categorical() -> None:
    df_mixed = pd.DataFrame({"a": [1, 2], "b": ["x", "y"]})
    assert utils.infer_feature_data_type(df_mixed) == "categorical"

    df_cat = pd.DataFrame({"a": pd.Series(["x", "y"], dtype="category")})
    assert utils.infer_feature_data_type(df_cat) == "categorical"


def test_estimate_spot_diameter_basic_grid() -> None:
    # Create a simple grid with spacing 10 (pixels). Nearest neighbor distance is 10.
    xs, ys = np.meshgrid(np.arange(0, 50, 10), np.arange(0, 50, 10))
    coords = pd.DataFrame({"x": xs.flatten(), "y": ys.flatten()})

    est = utils.estimate_spot_diameter(coords, m_per_px=1.0, subsample=5000, factor=0.55, rng=0)
    assert 5.0 < est < 6.0  # around 5.5


def test_estimate_spot_diameter_validations() -> None:
    with pytest.raises(ValueError):
        utils.estimate_spot_diameter(pd.DataFrame({"x": [0]}), m_per_px=1.0)
    with pytest.raises(ValueError):
        utils.estimate_spot_diameter(pd.DataFrame({"a": [0], "b": [1]}), m_per_px=1.0)
