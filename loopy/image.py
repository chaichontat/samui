# pyright: reportMissingTypeArgument=false, reportUnknownParameterType=false

import subprocess
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Annotated, Callable, Literal

import numpy as np
import numpy.typing as npt
import rasterio
from rasterio.enums import Resampling
from rasterio.io import DatasetWriter
from typing_extensions import Self

from loopy.logger import log
from loopy.utils.utils import ReadonlyModel, Url

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


def get_img_type(img: npt.NDArray, rgb: bool = False):
    if rgb:
        chans = img.shape[2]
        assert chans == 3
        height = img.shape[0]
        width = img.shape[1]
        zlast = True
    elif len(img.shape) == 2:  # 2D
        chans = 1
        height = img.shape[0]
        width = img.shape[1]
        zlast = False
    elif img.shape[0] < img.shape[2]:
        chans = img.shape[0]
        height = img.shape[1]
        width = img.shape[2]
        zlast = False
    else:
        chans = img.shape[2]
        height = img.shape[0]
        width = img.shape[1]
        zlast = True

    if chans > 50:
        log(f"Found {chans} channels. This is most likely incorrect.", "WARNING")

    def get_slide(img: npt.NDArray, i: int):
        if len(img.shape) == 2:
            return img
        else:
            return img[i] if not zlast else img[:, :, i]

    return chans, height, width, get_slide


def gen_geotiff(
    img: np.ndarray,
    name: str,
    path: Path,
    scale: float,
    translate: tuple[float, float] = (0, 0),
    rgb: bool = False,
) -> tuple[list[Path], int]:

    chans, height, width, get_slide = get_img_type(img, rgb)
    # JPEG compression can only handle up to 4 channels at a time.
    names, ncounts = gen_zcounts(chans)
    log(names, ncounts)
    ps = [path / (name + x + ".tif") for x in names]

    if img.dtype == np.uint8:
        ...
    elif img.dtype == np.uint16:
        log("Converting uint16 to uint8.", type_="WARNING")
        dived = np.divide(img, 256, casting="unsafe")
        del img
        img = dived.astype(np.uint8)
        del dived
    else:
        raise ValueError(f"Unsupported dtype for TIFF file. Found {img.dtype}. Expected uint8 or uint16.")

    def run(i: int):
        dst: DatasetWriter
        # Not compressing here since we cannot control the compression level.
        with rasterio.open(
            ps[i].with_suffix(".tif_").as_posix(),
            "w",
            driver="GTiff",
            height=height,
            width=width,
            count=ncounts[i],
            photometric="RGB" if rgb else "MINISBLACK",
            transform=rasterio.Affine(
                scale, 0, translate[0], 0, -scale, translate[1]
            ),  # https://gdal.org/tutorials/geotransforms_tut.html # Flip y-axis.
            dtype=np.uint8,
            crs="EPSG:32648",  # meters
            tiled=True,
        ) as dst:  # type: ignore
            log("Writing", ps[i])
            for j in range(ncounts[i]):
                idx = j + 4 * i
                dst.write(get_slide(img, idx), j + 1)
            dst.build_overviews([4, 8, 16, 32, 64], Resampling.nearest)

    with ThreadPoolExecutor() as executor:
        executor.map(run, range(len(ps)))
    log(f"Generated COG(s) {[p.as_posix() for p in ps]}")

    return ps, chans


def compress(ps: list[Path], quality: int = 90) -> None:
    def run(p: Path):
        out = []

        with subprocess.Popen(
            [
                "gdal_translate",
                p.with_suffix(".tif_").as_posix(),
                p.as_posix(),
                "-co",
                "TILED=YES",
                "-co",
                "COMPRESS=JPEG",
                "-co",
                "COPY_SRC_OVERVIEWS=YES",
                "-co",
                f"JPEG_QUALITY={int(quality)}",
            ],
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
        ) as process:
            for line in process.stdout:  # type: ignore
                log(p.name + ": " + (s := line.decode("utf-8")).strip())
                out.append(s)
        return out

    try:
        with ThreadPoolExecutor() as executor:
            executor.map(run, ps)
    except subprocess.CalledProcessError as e:
        raise e
    finally:
        for p in ps:
            if p.exists():
                p.with_suffix(".tif_").unlink()
            else:
                log(f"File not found: {p}", "ERROR")


def gen_zcounts(nc: int):
    if nc <= 0:
        raise ValueError("nchannels must be greater than 0")
    if nc >= 1000:
        raise ValueError(
            "nchannels is tested up to 1000. Perhaps you mixed up nchannels and other dimensions?"
        )

    if nc <= 4:
        names = [""]
        ncounts = [nc]
    else:
        names = [f"_{i}" for i in range(1, (nc - 1) // 4 + 2)]
        ncounts = [4] * (nc // 4) + ([nc % 4] if nc % 4 else [])

    return names, ncounts
