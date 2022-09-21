from pydantic import BaseModel

from loopy.feature import CoordParams, FeatureParams
from loopy.image import ImageParams


class Sample(BaseModel):
    name: str
    imgParams: ImageParams
    coordParams: list[CoordParams]
    featParams: list[FeatureParams]
