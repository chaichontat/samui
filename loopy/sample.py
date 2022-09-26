from loopy.feature import CoordParams, FeatureAndGroup, FeatureParams
from loopy.image import ImageParams
from loopy.utils import ReadonlyModel


class OverlayParams(ReadonlyModel):
    defaults: list[FeatureAndGroup] | None = None
    importantFeatures: list[FeatureAndGroup] | None = None


class Sample(ReadonlyModel):
    name: str
    imgParams: ImageParams | None = None
    coordParams: list[CoordParams] | None = None
    featParams: list[FeatureParams] | None = None
    overlayParams: OverlayParams | None = None
    notes: str | None = None
