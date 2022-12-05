#%%
import io
from pathlib import Path

import polars as pl

from loopy.feature import ChunkedCSVParams
from loopy.sample import Sample
from loopy.utils.utils import Url, concat

#%%
df = pl.read_csv(
    "C:/Users/Chaichontat/Downloads/datasets_mouse_brain_map_BrainReceptorShowcase_Slice1_Replicate1_detected_transcripts_S1R1.csv"
)
df = df.rename({"x": "x_coord", "y": "y_coord"})
df = df.rename({"global_x": "x", "global_y": "y"})
# %%
genes = df["gene"].unique()

names = []
to_concat = []
for g in genes:
    names.append(g)
    this = df.filter(df["gene"] == g)
    i = io.BytesIO()
    this[["x", "y"]].write_csv(i, float_precision=2)
    i.seek(0)
    to_concat.append(i.read())

ptr, outbytes = concat(to_concat)
Path("merfish.bin").write_bytes(outbytes)

#%%
out = Path("../static/merfish")
out.mkdir(exist_ok=True, parents=True)
# (out / "merfish_header.json").write_text(
#     ChunkedCSVHeader(names=names, ptr=ptr.tolist(), length=len(names)).json()
# )

mPerPx = 0.497e-6
sample = Sample(
    name="merfish",
    featParams=[
        ChunkedCSVParams(
            name="genes", headerUrl=Url("merfish_header.json"), url=Url("merfish.bin"), dataType="singular"
        )
    ],
)


(out / "sample.json").write_text(sample.json())
# %%
