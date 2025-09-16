from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, List, Tuple

import numpy as np
import pytest

from loopy.image import GeoTiff


def test_geotiff_from_img_infers_single_channel() -> None:
    arr = np.arange(9, dtype=np.uint8).reshape(3, 3)

    geotiff = GeoTiff.from_img(arr, scale=0.25)

    assert geotiff.height == 3
    assert geotiff.width == 3
    assert geotiff.chans == 1
    assert geotiff.zlast is False
    assert geotiff.rgb is False
    assert geotiff.img.dtype == np.uint8


def test_geotiff_from_img_channel_first_stack() -> None:
    arr = np.zeros((4, 5, 6), dtype=np.uint8)

    geotiff = GeoTiff.from_img(arr, scale=1.0)

    assert geotiff.chans == 4
    assert geotiff.height == 5
    assert geotiff.width == 6
    assert geotiff.zlast is False


def test_geotiff_from_img_rgb_last() -> None:
    arr = np.zeros((10, 7, 3), dtype=np.uint8)

    geotiff = GeoTiff.from_img(arr, scale=0.5, rgb=True)

    assert geotiff.rgb is True
    assert geotiff.zlast is True
    assert geotiff.chans == 3
    assert geotiff.height == 10
    assert geotiff.width == 7


def test_geotiff_from_img_converts_uint16_to_uint8_when_requested() -> None:
    arr = np.linspace(0, 1023, num=12, dtype=np.uint16).reshape(3, 4)

    geotiff = GeoTiff.from_img(arr, scale=1.0, convert_to_8bit=True)

    assert geotiff.img.dtype == np.uint8
    assert geotiff.height == 3
    assert geotiff.width == 4
    assert geotiff.chans == 1


def test_transform_tiff_executes_writer_for_each_chunk(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    data = np.arange(4 * 2 * 5, dtype=np.uint8).reshape(4, 2, 5)
    geotiff = GeoTiff.from_img(data, scale=0.2)

    calls: List[Tuple[Path, List[int], Dict[str, Any]]] = []

    def fake_writer(
        self: GeoTiff, path: Path, channels: List[int], transform: Any, logger: Any = None, quality: int = 99
    ) -> None:
        calls.append((path, channels, {"quality": quality, "transform": transform}))

    monkeypatch.setattr(GeoTiff, "_write_compressed_geotiff", fake_writer)

    names, run = geotiff.transform_tiff(tmp_path / "input.tif")

    assert names == ["input_1.tif", "input_2.tif"]

    run()

    assert [path.name for path, _, _ in calls] == ["input_1.tif", "input_2.tif"]
    assert [channels for _, channels, _ in calls] == [[0, 1, 2], [3]]


def test_transform_tiff_requires_tif_suffix(tmp_path: Path) -> None:
    data = np.zeros((1, 2, 2), dtype=np.uint8)
    geotiff = GeoTiff.from_img(data, scale=1.0)

    with pytest.raises(ValueError, match="Expected path to end with .tif"):
        geotiff.transform_tiff(tmp_path / "image.png")


def test_gen_zcounts_edge_cases() -> None:
    names, counts, chanlist = GeoTiff._gen_zcounts(3)
    assert names == [""]
    assert counts == [3]
    assert chanlist == [[0, 1, 2]]

    names_many, counts_many, chanlist_many = GeoTiff._gen_zcounts(5)
    assert names_many == ["_1", "_2"]
    assert counts_many == [3, 2]
    assert chanlist_many == [[0, 1, 2], [3, 4]]

    with pytest.raises(ValueError):
        GeoTiff._gen_zcounts(0)

    with pytest.raises(ValueError):
        GeoTiff._gen_zcounts(1000)


def test_get_slide_requires_valid_index() -> None:
    arr = np.arange(4, dtype=np.uint8).reshape(2, 2)
    geotiff = GeoTiff.from_img(arr, scale=1.0)

    assert np.array_equal(geotiff._get_slide(0), arr)

    with pytest.raises(ValueError):
        geotiff._get_slide(1)


def test_write_compressed_geotiff_uses_rasterio(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    data = np.zeros((2, 2), dtype=np.uint8)
    geotiff = GeoTiff.from_img(data, scale=1.0)

    records: Dict[str, Any] = {}

    class DummyDataset:
        def __init__(self) -> None:
            self.write_calls: List[Tuple[int, np.ndarray]] = []
            self.overviews: Tuple[List[int], Any] | None = None

        def __enter__(self) -> "DummyDataset":
            return self

        def __exit__(self, exc_type, exc, tb) -> None:
            return None

        def write(self, array: np.ndarray, idx: int) -> None:
            self.write_calls.append((idx, array))

        def build_overviews(self, factors: List[int], resampling: Any) -> None:
            self.overviews = (factors, resampling)

    dummy = DummyDataset()

    def fake_open(path: str, mode: str, **kwargs: Any) -> DummyDataset:
        records["path"] = path
        records["mode"] = mode
        records["kwargs"] = kwargs
        return dummy

    monkeypatch.setattr("loopy.image.rasterio.open", fake_open)

    result = geotiff._write_compressed_geotiff(tmp_path / "out", [0], transform=None)

    assert result is False
    assert records["path"].endswith("out.tif")
    assert records["mode"] == "w"
    assert records["kwargs"]["compress"] == "JPEG"
    assert dummy.write_calls[0][0] == 1
    assert dummy.write_calls[0][1].shape == (2, 2)
    assert dummy.overviews is not None


def test_write_compressed_geotiff_flags_uint16(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    data = np.zeros((2, 2), dtype=np.uint16)
    geotiff = GeoTiff.from_img(data, scale=1.0)

    class DummyDataset:
        def __enter__(self) -> "DummyDataset":
            return self

        def __exit__(self, exc_type, exc, tb) -> None:
            return None

        def write(self, array: np.ndarray, idx: int) -> None:
            pass

        def build_overviews(self, factors: List[int], resampling: Any) -> None:
            pass

    dummy = DummyDataset()

    def fake_open(path: str, mode: str, **kwargs: Any) -> DummyDataset:
        return dummy

    monkeypatch.setattr("loopy.image.rasterio.open", fake_open)

    result = geotiff._write_compressed_geotiff(tmp_path / "out", [0], transform=None)

    assert result is True


def test_write_compressed_geotiff_rejects_unsupported_dtype(tmp_path: Path) -> None:
    arr = np.zeros((2, 2), dtype=np.float32)
    geotiff = GeoTiff(
        img=arr,
        height=2,
        width=2,
        chans=1,
        scale=1.0,
        zlast=False,
    )

    with pytest.raises(ValueError, match="Unsupported dtype"):
        geotiff._write_compressed_geotiff(tmp_path / "foo", [0], transform=None)
