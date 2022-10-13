from pathlib import Path

import rich_click as click

from loopy.logger import setup_logging
from loopy.run_image import run_image

setup_logging()


@click.group()
def cli():
    pass


@cli.command()
@click.argument("tiff", nargs=1, type=click.Path(exists=True, dir_okay=False, path_type=Path))
@click.option(
    "--out",
    "-o",
    nargs=1,
    type=click.Path(exists=True, file_okay=False, path_type=Path),
    help="Output directory",
)
@click.option(
    "--channels",
    "-c",
    type=str,
    help="Channel names, split by comma. The number of channels must match those in the image.",
)
@click.option("--scale", "-s", default=1, type=float, help="Scale in meters per pixel.", show_default=True)
@click.option("--quality", default=90, type=int, help="JPEG compression quality.", show_default=True)
@click.option(
    "--translate",
    default=(0, 0),
    nargs=2,
    type=click.Tuple([float, float]),
    help="Translation to be applied in y and x.",
)
def image(
    tiff: Path,
    out: Path | None = None,
    channels: str | None = None,
    quality: int = 90,
    scale: float = 1,
    translate: tuple[float, float] = (0, 0),
) -> None:
    """Convert a TIFF file to a Loopy (COG) file."""
    run_image(tiff, out, channels, quality, scale, translate)


@cli.command()
def gui():
    """Start the Loopy Preprocessing GUI."""
    from loopy.gui.app import main

    main()
