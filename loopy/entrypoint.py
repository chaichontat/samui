from pathlib import Path

import rich_click as click

from loopy.logger import log
from loopy.sample import Sample


@click.group()
def cli():
    pass


@cli.command()
@click.argument("tiff", nargs=1, type=click.Path(exists=True, dir_okay=False, path_type=Path))
@click.option(
    "out",
    "--out",
    "-o",
    type=click.Path(file_okay=False, path_type=Path),
    help="Output directory containing the Loopy files. Defaults to the same directory as the input file.",
)
@click.option(
    "name",
    "-n",
    "--name",
    type=str,
    default=None,
    help="Name of the experiment. Defaults to file name. \
If you're combining this image with the spaceranger output, the name here must match the name given in that processing command.",
)
@click.option(
    "channels",
    "--channels",
    "-c",
    type=str,
    help="Channel names, split by comma. The number of channels must match those in the image.",
)
@click.option(
    "scale", "--scale", "-s", default=1, type=float, help="Scale in meters per pixel.", show_default=True
)
@click.option(
    "quality", "--quality", default=90, type=int, help="JPEG compression quality.", show_default=True
)
@click.option(
    "translate",
    "--translate",
    default=(0, 0),
    nargs=2,
    type=click.Tuple([float, float]),
    help="Translation to be applied in y and x.",
)
def image(
    tiff: Path,
    out: Path | None = None,
    name: str | None = None,
    channels: str | None = None,
    quality: int = 90,
    scale: float = 1,
    translate: tuple[float, float] = (0, 0),
) -> None:
    """Convert a TIFF file to a Loopy (COG) file."""
    import tifffile

    img = tifffile.imread(tiff)
    if name is None:
        name = tiff.stem
    if out is None:
        out = tiff.parent

    log(f"Processing {name} from file {tiff} with shape {img.shape}.")
    match channels:
        case None:
            c = None
        case "rgb":
            c = "rgb"
        case _:
            c = channels.split(",")

    (
        Sample(name=name, path=out / name)
        .add_image(tiff, channels=c, scale=scale, translate=translate, quality=quality)
        .write()
    )


@cli.command()
@click.argument("spaceranger_output", nargs=1, type=click.Path(exists=True, file_okay=False, path_type=Path))
@click.option(
    "out",
    "--out",
    "-o",
    nargs=1,
    type=click.Path(file_okay=False, path_type=Path),
    help="Output directory containing the Loopy files. \
Defaults to the spaceranger output's parent directory / loopy.",
)
@click.option(
    "name",
    "--name",
    "-n",
    type=str,
    help="Name of the experiment. Defaults to the one in the spaceranger's `--id` argument.",
)
@click.option(
    "spotDiam",
    "--spotDiam",
    default=55e-6,
    type=float,
    help="Diameter of the spots in meters.",
    show_default=True,
)
@click.option(
    "logTransform",
    "--logTransform",
    default=True,
    type=bool,
    help="Whether to log2-transform the data.",
    show_default=True,
)
def spaceranger(
    spaceranger_output: Path, out: Path | None, name: str, spotDiam: float, logTransform: bool
) -> None:
    """Get gene expression data from a spaceranger experiment. \
Assumes that Visium alignment has been done."""
    from loopy.drivers.spaceranger import run_spaceranger

    if out is None:
        out = spaceranger_output.parent / "loopy"

    run_spaceranger(name, spaceranger_output, out, spotDiam=spotDiam)
    # modify_sample(s, out, name)


@cli.command()
def gui():
    """Start the Loopy Preprocessing GUI."""
    from loopy.gui.app import main

    main()
