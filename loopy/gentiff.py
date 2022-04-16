import subprocess
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Any

import click
import numpy as np
import rasterio
import tifffile
from rasterio.enums import Resampling
from rasterio.io import DatasetWriter


def gen_geotiff(img: np.ndarray[Any, Any], path: Path) -> list[Path]:
    z = img.shape[0]
    if z < 4:
        names = ("_1",)
    elif z > 6:
        raise ValueError("Too many channels")
    else:
        names = ("_1", "_2")

    ps = [path.parent / (path.stem + x + ".tif_") for x in names]

    for i in range(len(names)):
        # Not compressing here since we cannot control compression level.
        dst: DatasetWriter
        with rasterio.open(
            ps[i],
            "w",
            driver="GTiff",
            height=img.shape[1],
            width=img.shape[2],
            count=3 + i if z > 5 else 3,
            transform=rasterio.Affine(
                0.497e-6, 0, 0, 0, -0.497e-6, 0
            ),  # https://gdal.org/tutorials/geotransforms_tut.html
            dtype=img.dtype,
            crs="EPSG:32648",  # meters
            tiled=True,
        ) as dst:  # type: ignore
            for j in range(3):
                idx = j + 3 * i
                dst.write(img[idx], j + 1)
            dst.build_overviews([4, 8, 16, 32, 64], Resampling.nearest)
    return ps


def compress(ps: list[Path], quality: int = 90) -> None:
    try:
        with ThreadPoolExecutor() as executor:
            executor.map(
                lambda i: subprocess.run(
                    f"gdal_translate {ps[i].as_posix()} {ps[i].as_posix()[:-1]} -co TILED=YES -co COMPRESS=JPEG -co COPY_SRC_OVERVIEWS=YES -co JPEG_QUALITY={quality}",
                    shell=True,
                    capture_output=True,
                    text=True,
                    check=True,
                ),
                range(len(ps)),
            )
    except subprocess.CalledProcessError as e:
        print(e.output)
        raise e
    else:
        for p in ps:
            p.unlink()


@click.command()
@click.argument("tiff", nargs=1, type=click.Path(exists=True, dir_okay=False, path_type=Path))
@click.argument("outdir", nargs=1, type=click.Path(exists=True, file_okay=False, path_type=Path))
@click.option("--quality", default=90, help="JPEG compression quality")
def run(tiff: Path, outdir: Path, quality: int = 90):
    img: np.ndarray[Any, Any] = tifffile.imread(tiff)
    ps = gen_geotiff(img, outdir)
    compress(ps, quality)


if __name__ == "__main__":
    run()
