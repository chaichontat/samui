from pathlib import Path

import click
import tifffile

from loopy.image import ImageParams, compress, gen_geotiff
from loopy.sample import Sample
from loopy.utils import Url


@click.command()
@click.argument("tiff", nargs=1, type=click.Path(exists=True, dir_okay=False, path_type=Path))
@click.option("--out", "-o", nargs=1, type=click.Path(exists=True, file_okay=False, path_type=Path))
@click.option("--channels", "-c", type=str, help="Channel names, split by comma.")
@click.option("--scale", "-s", default=1, type=float, help="Scale in meters per pixel.")
@click.option("--quality", default=90, type=int, help="JPEG compression quality")
def run(tiff: Path, outdir: Path | None = None, channels: str | None = None, quality: int = 90, scale: float = 1) -> None:
    s = tiff.stem
    if not tiff.exists():
        raise FileNotFoundError(tiff)

    if outdir is None:
        outdir = tiff.parent

    if tiff.suffix != ".tif" and tiff.suffix != ".tiff":
        raise ValueError("Input file must be a tiff.")

    img = tifffile.imread(tiff)

    print(f"Processing {s} with shape {img.shape}.")
    match channels:
        case None:
            c = [f"C{i}" for i in range(img.shape[0])]
        case "rgb":
            c = "rgb"
        case _:
            c = channels.split(",")
            c = [d.strip() for d in c]
            if len(c) != len(set(c)):
                raise ValueError("Channel names must be unique.")
            for d in c:
                try:
                    if not d.isalnum():
                        raise ValueError("Channel names must be alphanumeric. No spaces or special characters.")
                except ModuleNotFoundError:
                    raise ModuleNotFoundError("Windows users: please install windows-curses with `pip install windows-curses`.")
                if len(d) > 255:
                    raise ValueError("Channel names must be less than 256 characters.")

            if len(c) != img.shape[0]:
                raise ValueError(f"Number of channels does not match that of the image. Given {len(c)}, expected {img.shape[0]}.")

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
    ps = gen_geotiff(img, s, outdir / s, scale)
    print("Compressing image...")
    compress(ps, quality)
    print(f"Saved to {o.absolute()}.")
