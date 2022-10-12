from pathlib import Path

import click

from loopy.run_image import run_image


@click.group()
def cli():
    pass


@cli.command()
@click.argument("tiff", nargs=1, type=click.Path(exists=True, dir_okay=False, path_type=Path))
@click.option("--out", "-o", nargs=1, type=click.Path(exists=True, file_okay=False, path_type=Path))
@click.option("--channels", "-c", type=str, help="Channel names, split by comma.")
@click.option("--scale", "-s", default=1, type=float, help="Scale in meters per pixel.")
@click.option("--quality", default=90, type=int, help="JPEG compression quality")
@click.option(
    "--rotation",
    default=(0, 0),
    nargs=2,
    type=click.Tuple([float, float]),
    help="Rotation in row and column.",
)
def image(
    tiff: Path,
    out: Path | None = None,
    channels: str | None = None,
    quality: int = 90,
    scale: float = 1,
    rotation: tuple[float, float] = (0, 0),
) -> None:
    run_image(tiff, out, channels, quality, scale, rotation)


@cli.command()
def gui():
    from loopy.gui.app import main

    main()
