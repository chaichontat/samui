#%%
from pathlib import Path
from shutil import copy
from typing import Literal, cast

import numpy as np
import pandas as pd
from anndata import AnnData
from scanpy import read_visium
from tifffile import imread

from loopy.feature import ChunkedCSVParams, CoordParams, FeatureAndGroup, PlainCSVParams, get_compressed_genes
from loopy.image import Colors, ImageParams, compress, gen_geotiff
from loopy.sample import OverlayParams, Sample
from loopy.utils import Url, setwd

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
    header, bytedict = get_compressed_genes(
        vis.X, vis.var_names.to_list(), coordName="spots", mode=cast(Literal["csc", "csr"], orient)
    )
    print(p.absolute())

    p.with_suffix(".json").write_text(header.json().replace(" ", ""))
    p.with_suffix(".bin").write_bytes(bytedict)


def run_spaceranger(
    name: str,
    path: Path,
    tif: Path,
    out: Path,
    *,
    channels: list[str],
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
    df = pd.read_csv(path / name / "outs" / "metrics_summary.csv")
    metadata = "\n".join(
        f"{k}: {round(v, 3) if isinstance(v, float) else v}" for (k, v) in df.iloc[0].items()
    )

    Path(o / "metadata.md").write_text("```\n" + metadata + "\n```")
    copy(Path(path / name / "outs" / "web_summary.html"), o / "web_summary.html")

    # Image
    img = imread(tif)
    tifs = gen_geotiff(img, name, o, scale=mPerPx)
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
            ChunkedCSVParams(name="genes", url=Url("gene_csc.bin"), unit="Log counts").write(
                lambda p: write_compressed(vis, p)
            ),
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
    print("Done", name)
    return sample


#%%
if __name__ == "__main__":
    path = Path("C:/Users/Chaichontat/Documents/VIF")
    run_spaceranger(
        "Br2720_Ant_IF",
        path,
        path / "Br2720_Ant_IF.tif",
        path / "outs",
        channels=["Lipofuscin", "DAPI", "GFAP", "NeuN", "OLIG2", "TMEM119"],
        defaultChannels=dict(blue="DAPI", green="GFAP", red="NeuN"),
        overlayParams=OverlayParams(defaults=[FeatureAndGroup(feature="GFAP", group="genes")]),
        mPerPx=0.497e-6,
    )

# %%
