from pathlib import Path
from typing import Any, Callable, Concatenate, Generic, Literal, ParamSpec, Protocol, TypeVar

import pandas as pd
from anndata import AnnData
from pydantic import BaseModel
from tifffile import imread
from typing_extensions import Self

from loopy.feature import (
    CoordParams,
    FeatureAndGroup,
    FeatureParams,
    PlainCSVParams,
    compress_anndata_features,
)
from loopy.image import Colors, GeoTiff, ImageParams
from loopy.utils.utils import Url, remove_dupes


class OverlayParams(BaseModel):
    defaults: list[FeatureAndGroup] | None = None
    importantFeatures: list[FeatureAndGroup] | None = None


P, R = ParamSpec("P"), TypeVar("R", covariant=True)


# https://github.com/python/typing/discussions/1040
class Method(Protocol, Generic[P, R]):
    def __get__(self, instance: Any, owner: type | None = None) -> Callable[P, R]:
        ...

    def __call__(self_, self: Any, *args: P.args, **kwargs: P.kwargs) -> R:  # type: ignore
        ...


class Sample(BaseModel):
    name: str
    path: Path = None  # type: ignore  check_path removes the unhappy path.
    imgParams: ImageParams | None = None
    coordParams: list[CoordParams] | None = None
    featParams: list[FeatureParams] | None = None
    overlayParams: OverlayParams | None = None
    notesMd: Url | None = None
    metadataMd: Url | None = None

    @staticmethod
    def check_path(func: Callable[Concatenate[Any, P], R]) -> Method[P, R]:
        def wrapper(self: "Sample", *args: P.args, **kwargs: P.kwargs) -> R:
            if self.path is None:
                raise ValueError("Path not set. Use Sample.set_path() first")
            return func(self, *args, **kwargs)

        return wrapper

    def __init__(self, **data: Any):
        if data["path"] is not None:
            data["path"] = Path(data["path"])
            data["path"].mkdir(exist_ok=True, parents=True)
            if not data["path"].is_dir():
                raise ValueError(f"Path {data['path']} is not a directory")
        super().__init__(**data)

    def json(self, **kwargs: Any) -> str:
        return super().json(exclude={"path"}, **kwargs)

    @check_path
    def write(self) -> Self:
        (self.path / "sample.json").write_text(self.json())
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

    def set_path(self, path: Path) -> Self:
        self.path = path
        path.mkdir(exist_ok=True, parents=True)
        return self

    def _check_duplicates(self, name: str) -> None:
        if self.coordParams and name in [c.name for c in self.coordParams]:
            raise ValueError(f"Duplicate coord name {name}")
        if self.featParams and name in [f.name for f in self.featParams]:
            raise ValueError(f"Duplicate feature name {name}")

    @check_path
    def add_coords(self, df: pd.DataFrame, *, name: str, mPerPx: float = 1, size: float = 1e-2) -> Self:
        """Expects a dataframe with the index as the sample id or idx, x, y as columns

        Args:
            df (pd.DataFrame): DataFrame to be saved as csv
            path (Path): Path to the sample directory
            name (str): Name of the coordinates
        """
        df = remove_dupes(df)
        if not {"x", "y"}.issubset(df.columns):
            raise ValueError("x and y must be in columns")
        if (df.x.isnull() | df.y.isnull()).any():
            raise ValueError("x and y must not be null")
        df.to_csv(self.path / f"{name}.csv", index_label="id", float_format="%.6e")

        self.coordParams = self.coordParams or []
        if name in [c.name for c in self.coordParams]:
            self.coordParams = [c for c in self.coordParams if c.name != name]

        self.coordParams.append(
            CoordParams(url=Url(f"{name}.csv"), name=name, shape="circle", mPerPx=mPerPx, size=size)
        )
        return self

    @check_path
    def add_csv(
        self,
        df: pd.DataFrame,
        *,
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
            raise ValueError(f"Coord {coord_name} not found. Use Sample.add_coords() first")

        coord_params = [c for c in self.coordParams if c.name == coord_name][0]
        template = pd.read_csv(self.path / coord_params.url.url, index_col=0)

        joined = template.join(df).drop(columns=["x", "y"])
        for col in joined.columns:
            if joined[col].dtype == "object":
                joined[col] = joined[col].fillna("")
            else:
                joined[col] = joined[col].fillna(-1)

        joined.to_csv(self.path / f"{name}.csv", index_label="id", float_format="%.6e")
        self.featParams = self.featParams or []
        # Idempotent
        if name in [f.name for f in self.featParams]:
            self.featParams = [f for f in self.featParams if f.name != name]

        self.featParams.append(
            PlainCSVParams(name=name, url=Url(url=f"{name}.csv"), dataType=data_type, coordName=coord_name)
        )
        return self

    @check_path
    def add_image(
        self,
        tiff: Path,
        channels: list[str] | Literal["rgb"],
        scale: float = 1,
        quality: int = 90,
        translate: tuple[float, float] = (0, 0),
        defaultChannels: dict[Colors, str] | None = None,
    ):
        """Add an image to the sample

        Args:
            tiff (Path): Path to the tiff file
            channels (list[str] | Literal['rgb']): List of channels to use or 'rgb'
            scale (float, optional): Scale of the image. Defaults to 1.
            quality (int, optional): Quality of the image. Defaults to 90.
            translate (tuple[float,float], optional): Translation of the image. Defaults to (0,0).
        """
        if not tiff.exists():
            raise ValueError("Tiff file not found")

        geotiff = GeoTiff.from_img(imread(tiff), scale=scale, translate=translate, rgb=channels == "rgb")
        print(geotiff)
        names = geotiff.transform_tiff(self.path / f"{tiff.stem}.tif", quality=quality)

        self.imgParams = ImageParams.from_names(
            names,
            channels=channels,
            mPerPx=geotiff.scale,
            defaultChannels=defaultChannels,
        )
        return self

    def set_default_feature(self, *, group: str, feature: str) -> Self:
        self.overlayParams = self.overlayParams or OverlayParams()
        self.overlayParams.defaults = self.overlayParams.defaults or []
        # Check if already exists
        if not (fg := FeatureAndGroup(group=group, feature=feature)) in self.overlayParams.defaults:
            self.overlayParams.defaults.append(fg)
        return self
