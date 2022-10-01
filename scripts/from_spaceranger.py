#%%
from pathlib import Path
from shutil import copy
from typing import Literal, cast

import numpy as np
import pandas as pd
from anndata import AnnData
from scanpy import read_visium
from tifffile import TiffFile, imread

from loopy.feature import ChunkedCSVParams, CoordParams, PlainCSVParams, get_compressed_genes
from loopy.image import Colors, ImageParams, compress, gen_geotiff
from loopy.sample import OverlayParams, Sample
from loopy.utils import Url, setwd

#%% [markdown]

# The directory contains spaceranger outputs.
# The out directory contains folders of processed images and features.
# These can be fed directly to "Add samples" in the Loopy Browser.

#%%


analyses = {
    # "tsne": "analysis/tsne/2_components/projection.csv",
    # "umap": "analysis/umap/2_components/projection.csv",
    "cluster_graph": "analysis/clustering/graphclust/clusters.csv",
    "kmeans2": "analysis/clustering/kmeans_2_clusters/clusters.csv",
    "kmeans3": "analysis/clustering/kmeans_3_clusters/clusters.csv",
    "kmeans4": "analysis/clustering/kmeans_4_clusters/clusters.csv",
    "kmeans5": "analysis/clustering/kmeans_5_clusters/clusters.csv",
    "kmeans6": "analysis/clustering/kmeans_6_clusters/clusters.csv",
    "kmeans7": "analysis/clustering/kmeans_7_clusters/clusters.csv",
    "kmeans8": "analysis/clustering/kmeans_8_clusters/clusters.csv",
    "kmeans9": "analysis/clustering/kmeans_9_clusters/clusters.csv",
    "kmeans10": "analysis/clustering/kmeans_10_clusters/clusters.csv",
}


def better_visium(d: Path, features: dict[str, str]) -> AnnData:
    """Need to include spaceranger analyses into the the AnnData object
    to make sure that the indices match."""
    vis = read_visium(d)
    for k, v in features.items():
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


def write_compressed(vis: AnnData, p: Path):
    orient = "csc"
    header, bytedict = get_compressed_genes(vis, "spots", cast(Literal["csc", "csr"], orient))
    (p / f"gene_{orient}.json").write_text(header.json().replace(" ", ""))
    (p / f"gene_{orient}.bin").write_bytes(bytedict)


def run_spaceranger(
    name: str,
    path: Path,
    tif: Path,
    out: Path,
    *,
    channels: list[str] | None = None,
    defaultChannels: dict[Colors, str] | None = None,
    mPerPx: float = 1,
    spotDiam: float = 130e-6,
    overlayParams: OverlayParams | None = None,
) -> Sample:

    o = Path(out / name)
    o.mkdir(exist_ok=True, parents=True)

    # Count data
    vis = better_visium(path / name, features=analyses)
    vis.X.data = np.log2(vis.X.data + 1)  # type: ignore
    vis.var_names_make_unique()

    # Metadata
    df = pd.read_csv(path / name / "metrics_summary.csv")
    Path(o / "metadata.md").write_text(
        "```\n"
        + "\n".join([f"{i.name}: {round(i[0], 3) if isinstance(i[0], float) else i[0]}" for i in df[0]])
        + "\n```"
    )
    copy(Path(path / name / "web_summary.html"), o / "web_summary.html")

    # Image
    img = imread(tif)
    tifs = gen_geotiff(img, name, o / name, scale=mPerPx)
    compress(tifs)
    imgParams = ImageParams(
        urls=[Url(s.name) for s in tifs],
        channels=channels,
        mPerPx=mPerPx,
        defaultChannels=defaultChannels,
    )

    # Features
    with setwd(o):
        coordParams = [
            CoordParams(
                name="spots", shape="circle", mPerPx=mPerPx, size=spotDiam, url=Url("spotCoords.csv")
            ).write(lambda p: gen_coords(vis, p)),
        ]
        featParams = [
            ChunkedCSVParams(
                name="genes", headerUrl=Url("gene_csc.json"), url=Url("gene_csc.bin"), unit="Log counts"
            ).write(lambda p: write_compressed(vis, p)),
            PlainCSVParams(
                name="kmeans", url=Url("kmeans.csv"), dataType="categorical", coordName="spots"
            ).write(lambda p: vis.obs.filter(regex="^kmeans", axis=1).to_csv(p, index=False)),
        ]

    sample = Sample(
        name=name,
        metadataMd=Url("metadata.md"),
        overlayParams=overlayParams,
        imgParams=imgParams,
        coordParams=coordParams,
        featParams=featParams,
    )
    (o / "sample.json").write_text(sample.json())
    return sample


#%%
