from pathlib import Path
from typing import Literal

import pandas as pd
from pydantic import BaseModel
from typing_extensions import Self

from loopy.feature import CoordParams, FeatureAndGroup, FeatureParams, PlainCSVParams
from loopy.image import ImageParams
from loopy.utils.utils import Url


class OverlayParams(BaseModel):
    defaults: list[FeatureAndGroup] | None = None
    importantFeatures: list[FeatureAndGroup] | None = None


class Sample(BaseModel):
    name: str
    imgParams: ImageParams | None = None
    coordParams: list[CoordParams] | None = None
    featParams: list[FeatureParams] | None = None
    overlayParams: OverlayParams | None = None
    notesMd: Url | None = None
    metadataMd: Url | None = None

    def write(self, path: Path) -> Self:
        path.mkdir(parents=True, exist_ok=True)
        (path / "sample.json").write_text(self.json())
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

    def add_csv(
        self,
        df: pd.DataFrame,
        *,
        path: Path,
        name: str,
        coord_name: str,
        data_type: Literal["categorical", "quantitative"] = "quantitative",
    ) -> Self:
        """Expects a dataframe with the index as the sample id or idx.

        Args:
            df (pd.DataFrame): DataFrame to be saved as csv
            path (Path): Path to the sample directory
            name (str): Name of the feature
            coord_name (str): Name of the coordinates to link to

        Raises:
            ValueError: Coordinate name not found
        """

        if not self.coordParams or not coord_name in [c.name for c in self.coordParams]:
            raise ValueError(f"Coord {coord_name} not found")

        coord_params = [c for c in self.coordParams if c.name == coord_name][0]
        template = pd.read_csv(path / coord_params.url.url, index_col=0)

        joined = template.join(df).drop(columns=["x", "y"])
        for col in joined.columns:
            if joined[col].dtype == "object":
                joined[col] = joined[col].fillna("")
            else:
                joined[col] = joined[col].fillna(-1)

        joined.to_csv(path / f"{name}.csv", index_label="id")
        self.featParams = self.featParams or []
        # Idempotent
        if name in [f.name for f in self.featParams]:
            self.featParams = [f for f in self.featParams if f.name != name]

        self.featParams.append(
            PlainCSVParams(name=name, url=Url(url=f"{name}.csv"), dataType=data_type, coordName=coord_name)
        )
        return self

    def set_default_feature(self, *, group: str, feature: str) -> Self:
        self.overlayParams = self.overlayParams or OverlayParams()
        self.overlayParams.defaults = self.overlayParams.defaults or []
        # Check if already exists
        if not (fg := FeatureAndGroup(group=group, feature=feature)) in self.overlayParams.defaults:
            self.overlayParams.defaults.append(fg)
        return self
