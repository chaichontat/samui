from pathlib import Path

from typing_extensions import Self

from loopy.feature import CoordParams, FeatureAndGroup, FeatureParams
from loopy.image import ImageParams
from loopy.utils import ReadonlyModel, Url


class OverlayParams(ReadonlyModel):
    defaults: list[FeatureAndGroup] | None = None
    importantFeatures: list[FeatureAndGroup] | None = None


class Sample(ReadonlyModel):
    name: str
    imgParams: ImageParams | None = None
    coordParams: list[CoordParams] | None = None
    featParams: list[FeatureParams] | None = None
    overlayParams: OverlayParams | None = None
    notesMd: Url | None = None
    metadataMd: Url | None = None

    def write(self, path: Path) -> Self:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(self.json())
        return self
