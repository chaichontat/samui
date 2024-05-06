# pyright: reportMissingTypeArgument=false, reportUnknownParameterType=false

import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Annotated, Any, Callable, Literal

import numpy as np
import numpy.typing as npt
import rasterio
from pydantic import BaseModel
from rasterio.enums import Resampling
from rasterio.io import DatasetWriter
from tifffile import imread
from typing_extensions import Self

from loopy.logger import log
from loopy.utils.utils import Callback, ReadonlyModel, Url

Meter = Annotated[float, "meter"]
Colors = Literal["blue", "green", "red", "magenta", "yellow", "cyan", "white"]


class ImageParams(ReadonlyModel):
    urls: list[Url]
    channels: list[str] | Literal["rgb"]
    defaultChannels: dict[Colors, str] | None = None
    mPerPx: float
    dtype: Literal["uint8", "uint16"] | None = None
    maxVal: int | None = None

    def write(self, f: Callable[[Self], None]) -> Self:
        f(self)
        return self

    @classmethod
    def from_names(cls, names: list[str], **kwargs: Any) -> Self:
        return cls(urls=[Url(name) for name in names], **kwargs)


class GeoTiff(BaseModel):
    img: np.ndarray
    height: int
    width: int
    chans: int
    scale: float
    zlast: bool
    translate: tuple[float, float] = (0, 0)
    rgb: bool = False

    class Config:
        allow_mutation = False
        arbitrary_types_allowed = True

    @classmethod
    def from_tiff(
        cls,
        tif: Path,
        *,
        scale: float,
        translate: tuple[float, float] = (0, 0),
        rgb: bool = False,
        convert_to_8bit: bool = False,
    ) -> Self:
        return cls.from_img(
            imread(tif), scale=scale, translate=translate, rgb=rgb, convert_to_8bit=convert_to_8bit
        )

    @classmethod
    def from_img(
        cls,
        img: npt.NDArray,
        *,
        scale: float,
        translate: tuple[float, float] = (0, 0),
        rgb: bool = False,
        convert_to_8bit: bool = False,
    ) -> Self:
        if rgb:
            height, width, chans = img.shape
            assert chans == 3
            zlast = True
        elif len(img.shape) == 2:  # 2D
            chans = 1
            height, width = img.shape
            zlast = False
        elif img.shape[0] < img.shape[2]:
            chans, height, width = img.shape
            zlast = False
        else:
            height, width, chans = img.shape
            zlast = True

        if chans > 10:
            log(f"Found {chans} channels. This is most likely incorrect.", type_="WARNING")

        if img.dtype == np.uint8:
            ...
        elif img.dtype == np.uint16:
            if convert_to_8bit:
                log("Converting uint16 to uint8.", type_="WARNING")
                maxval = img.max()
                divide = 2 ** (int(np.log2(maxval)) + 1) // 256
                dived = np.divide(img, divide, casting="unsafe")  # So that this remains an uint16.
                del img
                img = dived.astype(np.uint8)
                del dived
        else:
            raise ValueError(f"Unsupported dtype for TIFF file. Found {img.dtype}. Expected uint8 or uint16.")

        return cls(
            img=img,
            height=height,
            width=width,
            chans=chans,
            scale=scale,
            translate=translate,
            zlast=zlast,
            rgb=rgb,
        )

    def transform_tiff(
        self, path_in: Path, *, quality: int = 90, logger: Callback = log
    ) -> tuple[list[str], Callable[[], None]]:
        logger(f"Transforming {path_in} to COG.")
        if path_in.suffix != ".tif":
            raise ValueError(f"Expected path to end with .tif, but found {path_in.suffix}")

        names, _, chanlist = self._gen_zcounts(self.chans)
        names = [path_in.stem + name + ".tif" for name in names]

        def run():
            if not names and not chanlist:
                return

            for name, c in zip(names, chanlist):
                self._write_compressed_geotiff(
                    path=path_in.with_name(name),
                    channels=c,
                    transform=rasterio.Affine(
                        self.scale, 0, self.translate[0], 0, -self.scale, -self.translate[1]
                    ),
                )

        return names, run

    @staticmethod
    def _gen_zcounts(nc: int):
        if nc <= 0:
            raise ValueError("nchannels must be greater than 0")
        if nc >= 1000:
            raise ValueError(
                "nchannels is tested up to 1000. Perhaps you mixed up nchannels and other dimensions?"
            )

        if nc <= 3:
            names = [""]
            ncounts = [nc]
            chanlist = [list(range(nc))]
        else:
            names = [f"_{i}" for i in range(1, (nc - 1) // 3 + 2)]
            ncounts = [3] * (nc // 3) + ([nc % 3] if nc % 3 else [])
            chanlist = [list(range(3 * i, 3 * (i + 1))) for i in range(nc // 3)] + (
                [list(range(3 * (nc // 3), nc))] if nc % 3 else []
            )

        return names, ncounts, chanlist

    def _get_slide(self, i: int = 0):
        if len(self.img.shape) == 2:
            if i != 0:
                raise ValueError(f"Received 2D image, but requested index {i} is not 0.")
            return self.img
        return self.img[i] if not self.zlast else self.img[:, :, i]

    def _write_compressed_geotiff(
        self, path: Path, channels: list[int], transform: rasterio.Affine, logger: Callback = log
    ):
        dst: DatasetWriter
        # Not compressing here since we cannot control the compression level.
        assert 0 < len(channels) <= 3
        dtype = self._get_slide(0).dtype
        if dtype != np.uint8 and dtype != np.uint16:
            raise ValueError(f"Unsupported dtype {dtype}. Expected uint8 or uint16.")

        with rasterio.open(
            path.with_suffix(".tif").as_posix(),
            "w",
            driver="GTiff",
            height=self.height,
            width=self.width,
            count=len(channels),
            transform=transform,  # https://gdal.org/tutorials/geotransforms_tut.html # Flip y-axis.
            dtype=dtype,
            crs="EPSG:32648",  # meters
            compress="LERC_DEFLATE" if dtype == np.uint16 else "JPEG",
            tiled="YES",
            JPEG_QUALITY=99,
            NUM_THREADS=16,
        ) as dst:  # type: ignore
            logger("Writing compressed GeoTIFF", path.as_posix())
            for idx_out, idx_in in enumerate(channels, 1):
                dst.write(self._get_slide(idx_in), idx_out)
            dst.build_overviews([4, 8, 16, 32, 64], Resampling.nearest)
        return dtype == np.uint16
