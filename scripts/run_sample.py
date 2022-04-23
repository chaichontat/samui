#%%
from pathlib import Path
from typing import Literal, cast

import numpy as np
import pandas as pd
from anndata import AnnData
from pydantic import BaseModel
from scanpy import read_visium
from tifffile import imread

from loopy.feature import (
    ChunkedJSONOptions,
    ChunkedJSONParams,
    FeatureParams,
    PlainJSONParams,
    get_compressed_genes,
)
from loopy.image import ImageParams, SpotParams, compress, gen_geotiff, gen_header
from loopy.utils import Url


class Sample(BaseModel):
    name: str
    imgParams: ImageParams
    featParams: list[FeatureParams]


directory = Path("/Users/chaichontat/Documents/VIF")
out = Path("/Users/chaichontat/GitHub/loopy-browser/static")
samples = ["Br2720_Ant_IF", "Br6432_Ant_IF", "Br6522_Ant_IF", "Br8667_Post_IF"]

channels = {
    "Lipofuscin": 1,
    "DAPI": 2,
    "GFAP": 3,
    "NeuN": 4,
    "OLIG2": 5,
    "TMEM119": 6,
}


analyses = {
    "tsne": "analysis/tsne/2_components/projection.csv",
    "umap": "analysis/umap/2_components/projection.csv",
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
    vis = read_visium(d)
    for k, v in features.items():
        df = pd.read_csv(d / v, index_col=0)
        if len(df.columns) == 1:
            df.rename(columns={df.columns[0]: k}, inplace=True)
        else:
            df.rename(columns={c: f"{k}_{i}" for i, c in enumerate(df.columns, 1)}, inplace=True)
        vis.obs = vis.obs.join(df, how="left")
    return vis


def run(s: str) -> None:
    sample = Sample(
        name=s,
        imgParams=ImageParams(
            urls=[Url(f"{s}_1.tif"), Url(f"{s}_2.tif")],
            headerUrl=Url("image.json"),
        ),
        featParams=[
            ChunkedJSONParams(name="genes", headerUrl=Url("gene_csc.json"), url=Url("gene_csc.bin")),
            ChunkedJSONParams(
                name="spotGenes",
                headerUrl=Url("gene_csr.json"),
                url=Url("gene_csr.bin"),
                options=ChunkedJSONOptions(densify=False),
            ),
            PlainJSONParams(name="umap", url=Url("umap.json"), dataType="coords"),
        ],
    )

    vis = better_visium(directory / s, features=analyses)
    vis.X.data = np.log2(vis.X.data + 1)
    vis.var_names_make_unique()

    o = Path(out / s)
    o.mkdir(exist_ok=True, parents=True)
    (o / "sample.json").write_text(sample.json())

    for orient in ["csr", "csc"]:
        header, bytedict = get_compressed_genes(
            vis, cast(Literal["csc", "csr"], orient), include_name=(orient == "csc")
        )
        (o / f"gene_{orient}.json").write_text(header.json().replace(" ", ""))
        (o / f"gene_{orient}.bin").write_bytes(bytedict)

    for k in analyses:
        if k in ["umap", "tsne"]:
            (o / f"{k}.json").write_text(
                vis.obs[[f"{k}_1", f"{k}_2"]]
                .rename(columns={f"{k}_1": "x", f"{k}_2": "y"})
                .to_json(orient="records", double_precision=3)
            )
        else:
            (o / f"{k}.json").write_text(vis.obs[k].to_json(orient="records", double_precision=3))
    spot = SpotParams()
    (o / "image.json").write_text(gen_header(vis, s, channels, spot).json().replace(" ", ""))
    img = imread(directory / (s + ".tif"))
    tifs = gen_geotiff(img, o / s, spot.mPerPx)
    compress(tifs)


for s in samples:
    run(s)

# %%
