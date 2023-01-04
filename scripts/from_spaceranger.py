#%%
import json
from pathlib import Path
from shutil import copy
from typing import Literal, cast

import numpy as np
import pandas as pd
from anndata import AnnData
from scanpy import read_visium

from loopy.feature import FeatureAndGroup
from loopy.image import Colors
from loopy.logger import log
from loopy.sample import OverlayParams, Sample
from loopy.utils.utils import Url

#%% [markdown]

# The directory contains spaceranger outputs.
# The out directory contains folders of processed images and features.
# These can be fed directly to "Add samples" in the Loopy Browser.

#%%
analyses = {
    "cluster_graph": "outs/analysis/clustering/graphclust/clusters.csv",
    "kmeans2": "outs/analysis/clustering/kmeans_2_clusters/clusters.csv",
    "kmeans3": "outs/analysis/clustering/kmeans_3_clusters/clusters.csv",
    "kmeans4": "outs/analysis/clustering/kmeans_4_clusters/clusters.csv",
    "kmeans5": "outs/analysis/clustering/kmeans_5_clusters/clusters.csv",
    "kmeans6": "outs/analysis/clustering/kmeans_6_clusters/clusters.csv",
    "kmeans7": "outs/analysis/clustering/kmeans_7_clusters/clusters.csv",
    "kmeans8": "outs/analysis/clustering/kmeans_8_clusters/clusters.csv",
    "kmeans9": "outs/analysis/clustering/kmeans_9_clusters/clusters.csv",
    "kmeans10": "outs/analysis/clustering/kmeans_10_clusters/clusters.csv",
}


def better_visium(d: Path, features: dict[str, str]) -> AnnData:
    """Need to include spaceranger analyses into the the AnnData object
    to make sure that the indices match."""
    vis = read_visium(d / "outs")
    for k, v in features.items():
        if not (d / v).exists():
            continue
        df = pd.read_csv(d / v, index_col=0)
        if len(df.columns) == 1:
            df.rename(columns={df.columns[0]: k}, inplace=True)
        else:
            df.rename(columns={c: f"{k}_{i}" for i, c in enumerate(df.columns, 1)}, inplace=True)
        vis.obs = vis.obs.join(df, how="left")
    return vis


def gen_coords(vis: AnnData, path: Path | str) -> None:
    spatial = cast(pd.DataFrame, vis.obsm["spatial"])
    coords = pd.DataFrame(
        spatial, columns=["x", "y"], index=pd.Series(vis.obs_names, name="id"), dtype="uint32"
    )
    return coords.to_csv(path)


def run_spaceranger(
    name: str,
    path: Path,
    tif: Path,
    out: Path,
    *,
    channels: list[str] | Literal["rgb"],
    defaultChannels: dict[Colors, str] | None = None,
    spotDiam: float = 55e-6,
    overlayParams: OverlayParams | None = None,
) -> Sample:

    o = Path(out / name)
    o.mkdir(exist_ok=True, parents=True)

    # Count data
    vis = better_visium(path / name, features=analyses)
    vis.X.data = np.log2(vis.X.data + 1)  # type: ignore
    vis.var_names_make_unique()

    # Metadata
    df = pd.read_csv(path / name / "outs" / "metrics_summary.csv")
    metadata = "\n".join(
        f"{k}: {round(v, 3) if isinstance(v, float) else v}" for (k, v) in df.iloc[0].items()
    )

    Path(o / "metadata.md").write_text("```\n" + metadata + "\n```")
    copy(Path(path / name / "outs" / "web_summary.html"), o / "web_summary.html")

    scales = json.loads((path / name / "outs" / "spatial" / "scalefactors_json.json").read_text())
    mPerPx = 65e-6 / float(scales["spot_diameter_fullres"])

    sample = (
        Sample(
            name=name,
            path=o,
            metadataMd=Url("metadata.md"),
        )
        .add_image(tif, channels, mPerPx, defaultChannels=defaultChannels)
        .add_coords(
            pd.DataFrame(
                cast(pd.DataFrame, vis.obsm["spatial"]),
                columns=["x", "y"],
                index=pd.Series(vis.obs_names, name="id"),
                dtype="uint32",
            ),
            name="spots",
            mPerPx=mPerPx,
            size=spotDiam,
        )
        .add_chunked_feature(vis.to_df(), name="genes", coordName="spots", unit="Log counts")
        .write()
    )

    log("Done", name)
    return sample


#%%
if __name__ == "__main__":
    path = Path("C:\\Users\\Chaichontat\\GitHub\\loopynew\\scripts\\out")
    run_spaceranger(
        "151673",
        path,
        path / "151673" / "outs" / "151673_full_image.tif",
        path / "outs",
        channels="rgb",
        overlayParams=OverlayParams(defaults=[FeatureAndGroup(feature="GFAP", group="genes")]),
    )

# %%
