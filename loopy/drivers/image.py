from pathlib import Path

import click
import tifffile

from loopy.logger import log
from loopy.sample import Sample


@click.command()
@click.argument("tiff", nargs=1, type=click.Path(exists=True, dir_okay=False, path_type=Path))
@click.argument("outdir", nargs=1, type=click.Path(file_okay=False, path_type=Path))
@click.option("--channels", "-c", type=str, help="Channel names, split by comma.")
@click.option("--quality", default=90, type=int, help="JPEG compression quality")
@click.option("--scale", default=1, type=float, help="Scale in meters per pixel.")
@click.option("--translate", default=(0, 0), type=(float, float), help="Translation in meters.")
def run_image(
    tiff: Path,
    outdir: Path,
    channels: str | None = None,
    quality: int = 90,
    scale: float = 1,
    translate: tuple[float, float] = (0, 0),
) -> None:
    s = tiff.stem
    img = tifffile.imread(tiff)

    log(f"Processing {s} with shape {img.shape}.")
    match channels:
        case None:
            c = [f"Channel{i}" for i in range(img.shape[0])]
        case "rgb":
            c = "rgb"
        case _:
            c = channels.split(",")
            if len(c) != img.shape[0]:
                raise ValueError("Number of channels does not match image shape")

    (
        Sample(name=s, path=outdir)
        .add_image(tiff, channels=c, scale=scale, translate=translate, quality=quality)
        .write()
    )


if __name__ == "__main__":
    run_image()
