#%%
from pathlib import Path
from typing import cast

import pandas as pd
from pydantic import BaseModel
from scanpy import read_visium


class SpotParams(BaseModel):
    spotDiam: float = 65e-6
    mPerPx: float = 0.497e-6


class Coords(BaseModel):
    x: int
    y: int


class ImageMetadata(BaseModel):
    sample: str
    coords: list[Coords]
    channel: dict[str, int]
    spot: SpotParams


adata = read_visium("../../br6522/")

spatial = cast(pd.DataFrame, adata.obsm["spatial"])
coords = pd.DataFrame(spatial, columns=["x", "y"], dtype="uint32")
coords = [Coords(x=row.x, y=row.y) for row in coords.itertuples()]  # type: ignore

imm = ImageMetadata(
    sample="Br6522",
    coords=coords,
    channel={
        "Lipofuscin": 1,
        "DAPI": 2,
        "GFAP": 3,
        "NeuN": 4,
        "OLIG2": 5,
        "TMEM119": 6,
    },
    spot=SpotParams(),
)

Path("image.json").write_text(imm.json().replace(" ", ""))
# %%
