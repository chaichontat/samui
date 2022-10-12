# pyright: reportMissingTypeArgument=false, reportUnknownParameterType=false

import subprocess
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Annotated, Callable, Literal

import numpy as np
import rasterio
from rasterio.enums import Resampling
from rasterio.io import DatasetWriter
from typing_extensions import Self

from loopy.utils import ReadonlyModel, Url

Meter = Annotated[float, "meter"]
Colors = Literal["blue", "green", "red", "magenta", "yellow", "cyan", "white"]


class ImageParams(ReadonlyModel):
    urls: list[Url]
    channels: list[str] | Literal["rgb"]
    defaultChannels: dict[Colors, str] | None = None
    mPerPx: float

    def write(self, f: Callable[[Self], None]) -> Self:
        f(self)
        return self


def gen_geotiff(
    img: np.ndarray,
    name: str,
    path: Path,
    scale: float,
    rotation: tuple[float, float] = (0, 0),
    rgb: bool = False,
) -> list[Path]:
    if rgb:
        z = img.shape[2]
        assert z == 3
        height = img.shape[0]
        width = img.shape[1]
        zlast = True
    elif len(img.shape) == 2:  # 2D
        z = 1
        height = img.shape[0]
        width = img.shape[1]
        zlast = False
    elif img.shape[0] < img.shape[2]:
        z = img.shape[0]
        height = img.shape[1]
        width = img.shape[2]
        zlast = False
    else:
        z = img.shape[2]
        height = img.shape[0]
        width = img.shape[1]
        zlast = True

    # JPEG compression can only handle up to 4 channels at a time.
    if z < 4:
        names = [""]
    elif z > 8:
        raise ValueError("Too many channels")
    else:
        names = ["_1", "_2"]

    ps = [path / (name + x + ".tif") for x in names]

    def run(i: int):
        dst: DatasetWriter
        # Not compressing here since we cannot control the compression level.
        with rasterio.open(
            ps[i].with_suffix(".tif_").as_posix(),
            "w",
            driver="GTiff",
            height=height,
            width=width,
            count=min(4, z) if i == 0 else z - 4,
            photometric="RGB" if rgb else "MINISBLACK",
            transform=rasterio.Affine(
                scale, 0, rotation[0], 0, -scale, rotation[1]
            ),  # https://gdal.org/tutorials/geotransforms_tut.html # Flip y-axis.
            dtype=np.uint8,
            crs="EPSG:32648",  # meters
            tiled=True,
        ) as dst:  # type: ignore
            print("Writing", ps[i])
            for j in range(4):
                idx = j + 4 * i
                if idx >= z:
                    break
                if len(img.shape) == 2:
                    towrite = img
                else:
                    towrite = img[idx] if not zlast else img[:, :, idx]

                if towrite.dtype == np.uint16:
                    print("Warning: converting uint16 to uint8")
                    towrite = np.divide(towrite, 256, casting="unsafe")
                    towrite = towrite.astype(np.uint8)

                dst.write(towrite, j + 1)
            dst.build_overviews([4, 8, 16, 32, 64], Resampling.nearest)

    with ThreadPoolExecutor() as executor:
        executor.map(run, range(len(ps)))
    print("Generated COG", ps)

    return ps


def compress(ps: list[Path], quality: int = 90) -> None:
    try:
        with ThreadPoolExecutor() as executor:
            executor.map(
                lambda p: subprocess.run(
                    f"gdal_translate {p.with_suffix('.tif_').as_posix()} {p.as_posix()} -co TILED=YES -co COMPRESS=JPEG -co COPY_SRC_OVERVIEWS=YES -co JPEG_QUALITY={quality}",
                    shell=True,
                    capture_output=True,
                    text=True,
                    check=True,
                ),
                ps,
            )
    except subprocess.CalledProcessError as e:
        print(e.output)
        raise e
    finally:
        for p in ps:
            if p.exists():
                p.with_suffix(".tif_").unlink()
            else:
                print("File not found:", p)
