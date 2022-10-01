from pathlib import Path

import click

from loopy.run_image import run_image

stdin_text = click.get_text_stream("stdin").read()


@click.command()
@click.argument("tiff", nargs=1, type=click.Path(exists=True, dir_okay=False, path_type=Path))
@click.option("--out", "-o", nargs=1, type=click.Path(exists=True, file_okay=False, path_type=Path))
@click.option("--channels", "-c", type=str, help="Channel names, split by comma.")
@click.option("--scale", "-s", default=1, type=float, help="Scale in meters per pixel.")
@click.option("--quality", default=90, type=int, help="JPEG compression quality")
def run(
    tiff: Path, out: Path | None = None, channels: str | None = None, quality: int = 90, scale: float = 1
) -> None:
    run_image(tiff, out, channels, quality, scale)