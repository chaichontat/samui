import time
from pathlib import Path

import click
import tifffile

from loopy.image import ImageParams, compress, gen_geotiff, gen_zcounts, get_img_type
from loopy.logger import log
from loopy.sample import Sample
from loopy.utils.utils import Url


@click.command()
@click.argument("tiff", nargs=1, type=click.Path(exists=True, dir_okay=False, path_type=Path))
@click.argument("outdir", nargs=1, type=click.Path(exists=True, file_okay=False, path_type=Path))
@click.option("--channels", "-c", type=str, help="Channel names, split by comma.")
@click.option("--quality", default=90, type=int, help="JPEG compression quality")
@click.option("--scale", default=1, type=float, help="Scale in meters per pixel.")
@click.option("--translate", default=(0, 0), type=(float, float), help="Translation in meters.")
def run(tiff: Path, outdir: Path, channels: str | None = None, quality: int = 90, scale: float = 1, translate: tuple[float,float]=(0,0)) -> None:
    s = tiff.stem
    img = tifffile.imread(tiff)

    print(f"Processing {s} with shape {img.shape}.")
    match channels:
        case None:
            c = [f"Channel {i}" for i in range(img.shape[0])]
        case "rgb":
            c = "rgb"
        case _:
            c = channels.split(",")
            if len(c) != img.shape[0]:
                raise ValueError("Number of channels does not match image shape")

    output = [Url(f"{s}.tif")] if img.shape[0] < 4 else [Url(f"{s}_1.tif"), Url(f"{s}_2.tif")]

    sample = Sample(
        name=s,
        imgParams=ImageParams(
            urls=output,
            channels=c,
            mPerPx=scale,
        ),
    )

    o = Path(outdir / s)
    o.mkdir(exist_ok=True, parents=True)
    (o / "sample.json").write_text(sample.json())

    img = tifffile.imread(tiff)
    chans, _, _,_ = get_img_type(img, channels == 'rgb')
    # JPEG compression can only handle up to 4 channels at a time.
    names, _ = gen_zcounts(chans)
    ps = [o / f"{s}{x}.tif" for x in names]
    gen_geotiff(img, s, outdir / s, scale=scale, translate=translate)
    time.sleep(0.5)  # Just to make sure the file is written before we try to read it.
    log("Compressing image...")
    compress(ps, quality)


if __name__ == "__main__":
    run()
