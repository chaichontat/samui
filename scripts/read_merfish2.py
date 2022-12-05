#%%
from pathlib import Path

import anndata as ad
import numpy as np
import pandas as pd
from scipy.sparse import csc_matrix

from loopy.feature import ChunkedCSVParams, CoordParams, FeatureAndGroup, get_compressed_genes
from loopy.sample import OverlayParams, Sample
from loopy.utils.utils import Url

#%%
feat = pd.read_csv(
    "../static/datasets-mouse_brain_map-BrainReceptorShowcase-Slice1-Replicate1-cell_by_gene_S1R1.csv",
    index_col=0,
    dtype=np.float32,
)
coords = pd.read_csv(
    "../static/datasets-mouse_brain_map-BrainReceptorShowcase-Slice1-Replicate1-cell_metadata_S1R1.csv",
    index_col=0,
    dtype=np.float32,
)


#%% Process coords
# rename column 0 to id
coords.rename(columns={"center_x": "x", "center_y": "y"})[["x", "y"]].to_csv(
    "coords.csv", index_label="id", float_format="%.2f"
)

#%% Process features
names = []
to_concat = []
sp = csc_matrix(feat.to_numpy())

orient = "csc"
header, bytedict = get_compressed_genes(ad.AnnData(np.log2(feat + 1)), coordName="cells", mode="csc")
p = Path("cells")
p.with_suffix(".json").write_text(header.json().replace(" ", ""))
p.with_suffix(".bin").write_bytes(bytedict)


#%%
out = Path("../static/merfish2")
out.mkdir(exist_ok=True, parents=True)
# (out / "merfish_header.json").write_text(
#     ChunkedCSVHeader(names=names, ptr=ptr.tolist(), length=len(names)).json()
# )

sample = Sample(
    name="merfish",
    coordParams=[
        CoordParams(url=Url(url="coords.csv"), shape="circle", name="cellCoords", mPerPx=0.5e-5, size=2e-6)
    ],
    overlayParams=OverlayParams(defaults=[FeatureAndGroup(feature="Oxgr1", group="cells")]),
    featParams=[
        ChunkedCSVParams(
            name="cells",
            headerUrl=Url("cells.json"),
            url=Url("cells.bin"),
            dataType="quantitative",
        )
    ],
)


(out / "sample.json").write_text(sample.json())
# %%
