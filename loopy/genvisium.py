#%%
from typing import cast

import pandas as pd
from anndata import AnnData
from pydantic import BaseModel


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


def get_img_metadata(vis: AnnData, sample: str, channels: dict[str, int]):
    spatial = cast(pd.DataFrame, vis.obsm["spatial"])
    coords = pd.DataFrame(spatial, columns=["x", "y"], dtype="uint32")
    coords = [Coords(x=row.x, y=row.y) for row in coords.itertuples()]  # type: ignore

    return ImageMetadata(
        sample=sample,
        coords=coords,
        channel=channels,
        spot=SpotParams(),
    )

# Path("image.json").write_text(imm.json().replace(" ", ""))
# %%
