#%%
import json
from pathlib import Path
from shutil import copy
from typing import Literal, cast

import numpy as np
import numpy.typing as npt
import pandas as pd
from anndata import AnnData
from scanpy import read_visium

from loopy.feature import ChunkedCSVParams, CoordParams, PlainCSVParams, get_compressed_genes
from loopy.logger import log
from loopy.sample import OverlayParams, Sample
from loopy.utils.utils import Url, setwd

ANALYSES = {
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
    log("Reading spaceranger output using scanpy.")
    vis = read_visium(d)
    for k, v in features.items():
        df = pd.read_csv(d / v, index_col=0)
        if len(df.columns) == 1:
            df.rename(columns={df.columns[0]: k}, inplace=True)
        else:
            df.rename(columns={c: f"{k}_{i}" for i, c in enumerate(df.columns, 1)}, inplace=True)
        vis.obs = vis.obs.join(df, how="left")
    return vis


def gen_coords(vis: AnnData, path: Path | str) -> None:  # pyright: ignore [reportUnknownParameterType]
    spatial = cast(pd.DataFrame, vis.obsm["spatial"])
    coords = pd.DataFrame(
        spatial, columns=["x", "y"], index=pd.Series(vis.obs_names, name="id"), dtype="uint32"
    )
    return coords.to_csv(path)


def write_compressed(vis: AnnData, p: Path) -> None:  # pyright: ignore [reportUnknownParameterType]
    orient = "csc"
    header, bytedict = get_compressed_genes(
        cast(npt.ArrayLike, vis.X),
        vis.var_names.to_list(),
        coordName="spots",
        mode=cast(Literal["csc", "csr"], orient),
    )

    p.with_suffix(".json").write_text(header.json().replace(" ", ""))
    p.with_suffix(".bin").write_bytes(bytedict)


def run_spaceranger(
    path: Path,
    out: Path,
    *,
    name: str | None = None,
    spotDiam: float = 55e-6,
    overlayParams: OverlayParams | None = None,
    logTransform: bool = True,
) -> tuple[Sample, str]:
    p = path / "outs"
    metrics_summary = pd.read_csv(p / "metrics_summary.csv")

    if name is None:
        name = metrics_summary["Sample ID"][0]
    if not name:
        raise ValueError(f"Cannot find name from {p / 'metrics_summary.csv'}.")

    log(f"Processing spaceranger sample {name}.")

    o = Path(out / name)
    o.mkdir(exist_ok=True, parents=True)

    # Count data
    vis = better_visium(p, features=ANALYSES)
    if logTransform:
        vis.X.data = np.log2(vis.X.data + 1)  # type: ignore
    vis.var_names_make_unique()

    # Metadata
    metadata = "\n".join(
        f"{k}: {round(v, 3) if isinstance(v, float) else v}" for (k, v) in metrics_summary.iloc[0].items()
    )
    Path(o / "metadata.md").write_text("```\n" + metadata + "\n```")
    copy(Path(p / "web_summary.html"), o / "web_summary.html")

    # https://support.10xgenomics.com/spatial-gene-expression/software/pipelines/latest/output/spatial
    # The number of pixels that span the diameter of a theoretical 65µm spot in the original, full-resolution image.
    px_65um: float = json.loads((p / "spatial" / "scalefactors_json.json").read_text())[
        "spot_diameter_fullres"
    ]
    mPerPx = 65e-6 / px_65um

    # Features
    with setwd(o):
        log("Getting spot coordinates.")
        coordParams = [
            CoordParams(
                name="spots", shape="circle", mPerPx=mPerPx, size=spotDiam, url=Url("spotCoords.csv")
            ).write(lambda p: gen_coords(vis, p)),
        ]
        log("Compressing gene expression data.")
        featParams = [
            ChunkedCSVParams(name="genes", url=Url("gene_csc.bin"), unit="Log counts").write(
                lambda p: write_compressed(vis, p)
            ),
            PlainCSVParams(
                name="kmeans", url=Url("kmeans.csv"), dataType="categorical", coordName="spots"
            ).write(
                lambda p: vis.obs.filter(regex="^kmeans", axis=1).to_csv(
                    p, index=False  # pyright: ignore [reportUnknownLambdaType]
                )
            ),
        ]

    sample = Sample(
        name=name,
        metadataMd=Url("metadata.md"),
        overlayParams=overlayParams,
        coordParams=coordParams,
        featParams=featParams,
    )
    log(sample.json())
    log("Processed spaceranger:", name)
    return sample, name
