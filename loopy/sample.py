from pathlib import Path

from typing_extensions import Self

from loopy.feature import CoordParams, FeatureAndGroup, FeatureParams
from loopy.image import ImageParams
from loopy.logger import log
from loopy.utils.utils import ReadonlyModel, Url


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
        log(self.json())
        return self

    def append(self, other: Self) -> Self:
        """Very wasteful"""
        # other = deepcopy(other)
        # coordParams, featParams = None, None
        # if self.coordParams is not None:
        #     cp = deepcopy(self.coordParams)
        #     coordParams = cp.extend(other.coordParams or []) or cp
        # if self.featParams is not None:
        #     fp = deepcopy(self.featParams)
        #     featParams = fp.extend(other.featParams or []) or fp

        params = self.dict()
        params.update(other.dict(exclude_none=True))
        # params.update({"coordParams": coordParams, "featParams": featParams})
        return Sample(**params)

    def __add__(self, other: Self) -> Self:
        return self.append(other)
