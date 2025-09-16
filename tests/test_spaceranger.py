from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List

import numpy as np
import pandas as pd
import pytest

from loopy.drivers import spaceranger


class DummyAnnData:
    def __init__(self) -> None:
        self.obs = pd.DataFrame(index=pd.Index(["spot1", "spot2"], dtype=object))
        self.obs_names = self.obs.index
        self.obsm: Dict[str, Any] = {"spatial": np.array([[0, 1], [2, 3]], dtype=float)}
        self.X = type("Dummy", (), {"data": np.array([1.0, 3.0])})()
        self.var_names = pd.Index(["gene1", "gene2"])
        self._var_names_unique = False

    def var_names_make_unique(self) -> None:
        self._var_names_unique = True

    def to_df(self) -> pd.DataFrame:
        return pd.DataFrame({"gene1": [1.0, 3.0], "gene2": [2.0, 4.0]}, index=self.obs.index)


def test_better_visium_joins_features(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    base = tmp_path / "sample"
    (base / "outs/analysis/clustering/kmeans_2_clusters").mkdir(parents=True)
    clusters = pd.DataFrame({"column": ["a", "b"]}, index=["spot1", "spot2"])
    clusters.to_csv(base / spaceranger.analyses["kmeans2"], index=True)

    def fake_read_visium(path: Path) -> DummyAnnData:
        assert path == base / "outs"
        return DummyAnnData()

    monkeypatch.setattr(spaceranger, "read_visium", fake_read_visium)

    vis = spaceranger.better_visium(base, {"kmeans2": spaceranger.analyses["kmeans2"]})

    assert "kmeans2" in vis.obs.columns
    assert vis.obs.loc["spot1", "kmeans2"] == "a"


def test_gen_coords_exports_dataframe(tmp_path: Path) -> None:
    ann = DummyAnnData()
    out = tmp_path / "coords.csv"

    spaceranger.gen_coords(ann, out)

    df = pd.read_csv(out, index_col=0)
    assert list(df.columns) == ["x", "y"]
    assert list(df.index) == ["spot1", "spot2"]


def test_run_spaceranger_creates_outputs(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    root = tmp_path / "input"
    name = "demo"
    out_dir = tmp_path / "loopy"

    metrics = pd.DataFrame({"reads": [123.456], "spots": [987]})
    spatial_dir = root / name / "outs" / "spatial"
    spatial_dir.mkdir(parents=True)
    metrics.to_csv(root / name / "outs" / "metrics_summary.csv", index=False)
    (root / name / "outs" / "web_summary.html").write_text("<html>")
    (spatial_dir / "scalefactors_json.json").write_text(json.dumps({"spot_diameter_fullres": 2}))

    monkeypatch.setattr(spaceranger, "better_visium", lambda path, features: DummyAnnData())

    recorded_calls: List[str] = []

    class DummySample:
        def __init__(self, **kwargs: Any) -> None:
            self.kwargs = kwargs
            self.path = kwargs["path"]

        def add_image(self, *args: Any, **kwargs: Any) -> "DummySample":
            recorded_calls.append("add_image")
            return self

        def add_coords(self, df: pd.DataFrame, **kwargs: Any) -> "DummySample":
            recorded_calls.append("add_coords")
            assert list(df.columns) == ["x", "y"]
            return self

        def add_chunked_feature(self, df: pd.DataFrame, **kwargs: Any) -> "DummySample":
            recorded_calls.append("add_chunked_feature")
            return self

        def write(self) -> "DummySample":
            recorded_calls.append("write")
            return self

    monkeypatch.setattr(spaceranger, "Sample", DummySample)

    sample = spaceranger.run_spaceranger(name, root, out_dir, tif=None)

    assert isinstance(sample, DummySample)
    assert (out_dir / name / "metadata.md").exists()
    assert (out_dir / name / "web_summary.html").exists()
    assert recorded_calls[-1] == "write"
    assert "add_coords" in recorded_calls
    assert "add_chunked_feature" in recorded_calls
