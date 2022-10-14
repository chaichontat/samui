from pathlib import Path

import tifffile

from loopy.image import ImageParams, compress, gen_geotiff, get_img_type
from loopy.logger import log
from loopy.sample import Sample
from loopy.utils.utils import Url


def run_image(
    tiff: Path,
    out: Path,
    *,
    name: str | None = None,
    channels: str | None = None,
    quality: int = 90,
    scale: float = 1,
    translate: tuple[float, float] = (0, 0),
) -> tuple[Sample, str]:

    if not name:
        name = tiff.stem

    if not tiff.exists():
        raise FileNotFoundError(tiff)

    if tiff.suffix != ".tif" and tiff.suffix != ".tiff":
        raise ValueError("Input file must be a tiff.")

    img = tifffile.imread(tiff)
    chans, *_ = get_img_type(img, rgb=channels == "rgb")

    log(f"Processing {name} with {chans} channels and {img.shape}.")
    match channels:
        case None:
            c = [f"C{i}" for i in range(chans)]
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
                        raise ValueError(
                            "Channel names must be alphanumeric. No spaces or special characters."
                        )
                except ModuleNotFoundError:
                    raise ModuleNotFoundError(
                        "Windows users: please install windows-curses with `pip install windows-curses`."
                    )
                if len(d) > 255:
                    raise ValueError("Channel names must be less than 256 characters.")

            if len(c) != chans:
                raise ValueError(
                    f"Number of channels does not match that of the image. Given {len(c)}, expected {chans}."
                )

    o = Path(out / name)
    ps, _ = gen_geotiff(img, name, out / name, scale, translate, channels == "rgb")
    log("Compressing image(s)...")
    compress(ps, quality)
    log(f"Saved processed TIFF(s) to {o.absolute()}.")

    sample = Sample(
        name=name,
        imgParams=ImageParams(
            urls=[Url(p.name) for p in ps],
            channels=c,
            mPerPx=scale,
        ),
    )

    return sample, name
