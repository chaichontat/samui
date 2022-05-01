from pydantic import BaseModel

from loopy.feature import FeatureParams
from loopy.image import ImageParams


class Sample(BaseModel):
    name: str
    imgParams: ImageParams
    featParams: list[FeatureParams]
