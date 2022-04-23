from pathlib import Path
from typing import Literal, cast

import numpy as np
import pandas as pd
from anndata import AnnData
from scanpy import read_visium
from tifffile import imread

from loopy.feature import ChunkedJSONOptions, ChunkedJSONParams, PlainJSONParams, get_compressed_genes
from loopy.image import ImageParams, SpotParams, compress, gen_geotiff, gen_header
from loopy.sample import Sample
from loopy.utils import Url


def test_sample():
    channels = {
        "Lipofuscin": 1,
        "DAPI": 2,
        "GFAP": 3,
        "NeuN": 4,
        "OLIG2": 5,
        "TMEM119": 6,
    }
    s = "Br8667_Post_IF"
    directory = Path("data") / s
    out = Path("temp/")
    out.mkdir(exist_ok=True, parents=True)

    analyses = {"umap": "projection.csv"}

    vis = better_visium(directory, features=analyses)
    vis.X.data = np.log2(vis.X.data + 1)
    vis.var_names_make_unique()

    run(vis, directory, out, "Br8667_Post_IF", analyses)
    img(vis, Path("data/test_img.tiff"), out, "Br8667_Post_IF", channels)


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


def run(vis: AnnData, directory: Path, out: Path, s: str, analyses: dict[str, str]) -> None:
    sample = Sample(
        name=s,
        imgParams=ImageParams(
            urls=[Url(f"{s}_1.tif"), Url(f"{s}_2.tif")],
            headerUrl=Url("image.json"),
        ),
        featParams=[
            ChunkedJSONParams(name="genes", headerUrl=Url("gene_csc.json"), url=Url("gene_csc.bin")),
            PlainJSONParams(name="umap", url=Url("umap.json"), dataType="coords"),
        ],
    )

    o = Path(out / s)
    o.mkdir(exist_ok=True, parents=True)
    (o / "sample.json").write_text(sample.json())

    for orient in ["csc"]:
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


def img(vis: AnnData, directory: Path, o: Path, s: str, channels: dict[str, int]):
    spot = SpotParams()
    (o / "image.json").write_text(gen_header(vis, s, channels, spot).json().replace(" ", ""))
    img = imread(directory)
    tifs = gen_geotiff(img, o / s, spot.mPerPx)
    compress(tifs)
