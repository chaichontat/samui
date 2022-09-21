from pydantic import BaseModel

from loopy.feature import CoordParams, FeatureParams
from loopy.image import ImageParams


class Sample(BaseModel):
    name: str
    imgParams: ImageParams | None = None
    coordParams: list[CoordParams] | None = None
    featParams: list[FeatureParams] | None = None
