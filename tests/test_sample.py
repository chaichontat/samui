from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Callable, List, Tuple

import numpy as np
import pandas as pd
import pytest

from loopy.feature import ChunkedCSVHeader
from loopy.sample import OverlayParams, Sample
from loopy.utils.utils import Url


def coord_df() -> pd.DataFrame:
    return pd.DataFrame({"x": [0, 1], "y": [1, 2]}, index=pd.Index(["a", "b"], dtype=object))


def feature_df() -> pd.DataFrame:
    return pd.DataFrame({"gene": [3.0, 5.0]}, index=pd.Index(["a", "b"], dtype=object))


def test_sample_requires_name_if_no_existing(tmp_path: Path) -> None:
    with pytest.raises(ValueError):
        Sample(path=tmp_path / "missing")


def test_sample_loads_existing_sample_json(tmp_path: Path) -> None:
    target = tmp_path / "existing"
    original = Sample(name="demo", path=target, lazy=False)
    original.coordParams = []
    original.write()

    loaded = Sample(path=target)

    assert loaded.name == "demo"
    assert loaded.path == target


def test_queue_is_per_instance(tmp_path: Path) -> None:
    s1 = Sample(name="first", path=tmp_path / "first")
    s2 = Sample(name="second", path=tmp_path / "second")

    s1.queue_.append(("noop", lambda: None))

    assert not s2.queue_


def test_set_path_creates_directory(tmp_path: Path) -> None:
    sample = Sample(name="sample")
    new_path = tmp_path / "new"

    sample.set_path(new_path)

    assert sample.path == new_path
    assert new_path.exists()


def test_add_coords_lazy_queue_and_write_executes(tmp_path: Path) -> None:
    sample = Sample(name="demo", path=tmp_path / "demo")
    df = coord_df()

    sample.add_coords(df, name="spots", mPerPx=0.5, size=10)

    assert sample.coordParams and sample.coordParams[-1].name == "spots"
    assert len(sample.queue_) == 1
    assert not (sample.path / "spots.csv").exists()

    sample.write()

    assert not sample.queue_
    assert (sample.path / "spots.csv").exists()


def test_add_coords_validates_indices(tmp_path: Path) -> None:
    sample = Sample(name="check", path=tmp_path / "check", lazy=False)

    bad = coord_df().copy()
    bad.index = ["a", "a"]

    with pytest.raises(ValueError, match="not unique"):
        sample.add_coords(bad, name="dup")

    missing = pd.DataFrame({"x": [0, 1]}, index=pd.Index(["a", "b"], dtype=object))
    with pytest.raises(ValueError, match="x and y"):
        sample.add_coords(missing, name="missing")


def test_add_csv_feature_requires_coords_first(tmp_path: Path) -> None:
    sample = Sample(name="demo", path=tmp_path / "demo", lazy=False)

    with pytest.raises(ValueError, match="Coord name"):
        sample.add_csv_feature(feature_df(), name="gene", coordName="spots")


def test_add_csv_feature_writes_file(tmp_path: Path) -> None:
    sample = Sample(name="demo", path=tmp_path / "demo", lazy=False)
    sample.add_coords(coord_df(), name="spots")

    sample.add_csv_feature(feature_df(), name="gene", coordName="spots")

    assert (sample.path / "gene.csv").exists()
    assert sample.featParams and sample.featParams[-1].name == "gene"


def test_add_chunked_feature_writes_header_and_bytes(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    sample = Sample(name="demo", path=tmp_path / "demo", lazy=False)
    sample.add_coords(coord_df(), name="spots")

    header = ChunkedCSVHeader(names=["gene"], ptr=[0, 4], length=2, sparseMode=None)
    payload = bytearray(b"test")

    def fake_compress(df: pd.DataFrame, logger: Callable[..., None]) -> Tuple[ChunkedCSVHeader, bytearray]:
        return header, payload

    monkeypatch.setattr("loopy.sample.compress_chunked_features", fake_compress)

    sample.add_chunked_feature(feature_df(), name="gene_chunk", coordName="spots")

    assert (sample.path / "gene_chunk.json").read_text() == header.json()
    assert (sample.path / "gene_chunk.bin").read_bytes() == payload
    assert sample.featParams and sample.featParams[-1].name == "gene_chunk"


def test_add_chunked_feature_sparse_path(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    sample = Sample(name="demo", path=tmp_path / "demo", lazy=False)
    sample.add_coords(coord_df(), name="spots")

    header = ChunkedCSVHeader(names=["gene"], ptr=[0, 2], length=2, sparseMode="array")
    payload = bytearray(b"sp")

    def fake_sparse(df: pd.DataFrame, mode: str, logger: Callable[..., None]) -> Tuple[ChunkedCSVHeader, bytearray]:
        assert mode == "csc"
        return header, payload

    monkeypatch.setattr("loopy.sample.sparse_compress_chunked_features", fake_sparse)

    sample.add_chunked_feature(feature_df(), name="gene_sparse", coordName="spots", sparse=True)

    assert (sample.path / "gene_sparse.json").exists()
    assert (sample.path / "gene_sparse.bin").read_bytes() == payload


def test_write_executes_queued_operations(tmp_path: Path) -> None:
    sample = Sample(name="demo", path=tmp_path / "demo")
    called: List[str] = []
    sample.queue_.append(("custom", lambda: called.append("done")))

    sample.write()

    assert called == ["done"]
    assert (sample.path / "sample.json").exists()


def test_do_not_execute_previous_pops_queue(tmp_path: Path) -> None:
    sample = Sample(name="demo", path=tmp_path / "demo")
    sample.queue_.append(("first", lambda: None))
    sample.queue_.append(("second", lambda: None))

    sample.do_not_execute_previous()

    assert len(sample.queue_) == 1
    assert sample.queue_[0][0] == "first"


def test_delete_coords_removes_file(tmp_path: Path) -> None:
    sample = Sample(name="demo", path=tmp_path / "demo", lazy=False)
    sample.add_coords(coord_df(), name="spots")

    assert (sample.path / "spots.csv").exists()

    sample.delete_coords("spots")

    assert not (sample.path / "spots.csv").exists()
    assert not sample.coordParams


def test_delete_feature_removes_associated_artifacts(tmp_path: Path) -> None:
    sample = Sample(name="demo", path=tmp_path / "demo", lazy=False)
    sample.add_coords(coord_df(), name="spots")
    sample.add_csv_feature(feature_df(), name="gene", coordName="spots")

    sample.delete_feature("gene")

    assert not sample.featParams
    assert not (sample.path / "gene.csv").exists()


def test_set_default_feature_deduplicates(tmp_path: Path) -> None:
    sample = Sample(name="demo", path=tmp_path / "demo", lazy=False)
    sample.overlayParams = OverlayParams(defaults=[])

    sample.set_default_feature(group="cluster", feature="gene")
    sample.set_default_feature(group="cluster", feature="gene")

    assert sample.overlayParams
    assert sample.overlayParams.defaults == [
        sample.overlayParams.defaults[0]
    ]  # only one entry


def test_json_excludes_runtime_fields(tmp_path: Path) -> None:
    sample = Sample(name="demo", path=tmp_path / "demo", lazy=False)
    sample.add_coords(coord_df(), name="spots")

    parsed = json.loads(sample.json())

    assert "path" not in parsed
    assert "queue_" not in parsed
    assert parsed["coordParams"][0]["name"] == "spots"


def test_add_image_populates_params_and_queue(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    tiff = tmp_path / "image.tif"
    tiff.write_bytes(b"tif")

    class DummyGeo:
        chans = 2
        scale = 0.25
        img = np.zeros((2, 2, 2), dtype=np.uint8)

        def transform_tiff(self, path: Path, quality: int = 90, logger: Callable[..., None] | None = None):
            called.append(path)
            return ["image_1.tif"], lambda: executed.append("run")

    called: List[Path] = []
    executed: List[str] = []

    def fake_from_tiff(path: Path, **kwargs: Any) -> DummyGeo:
        assert path == tiff
        return DummyGeo()

    monkeypatch.setattr("loopy.sample.GeoTiff.from_tiff", fake_from_tiff)

    sample = Sample(name="demo", path=tmp_path / "demo")
    sample.add_image(tiff, scale=0.25)

    expected_output = sample.path / "image.tif"
    assert called == [expected_output]
    assert sample.queue_
    assert sample.imgParams
    assert sample.imgParams.urls[0].url == "image_1.tif"
    assert sample.imgParams.channels == ["C1", "C2"]

    sample.write()

    assert executed == ["run"]


def test_add_image_with_custom_channels_validates_length(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    tiff = tmp_path / "image.tif"
    tiff.write_bytes(b"tif")

    class DummyGeo:
        chans = 3
        scale = 1.0
        img = np.zeros((3, 2, 2), dtype=np.uint8)

        def transform_tiff(self, path: Path, quality: int = 90, logger: Callable[..., None] | None = None):
            return ["image_1.tif"], lambda: None

    monkeypatch.setattr("loopy.sample.GeoTiff.from_tiff", lambda *_, **__: DummyGeo())

    sample = Sample(name="demo", path=tmp_path / "demo", lazy=False)

    with pytest.raises(ValueError, match="channels"):
        sample.add_image(tiff, channels=["one"])
