from pydantic import BaseModel

from loopy.feature import FeatureParams, OverlayParams
from loopy.image import ImageParams


class Sample(BaseModel):
    name: str
    imgParams: ImageParams
    overlayParams: list[OverlayParams]
    featParams: list[FeatureParams]
