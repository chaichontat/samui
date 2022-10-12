from pathlib import Path

import tifffile

from loopy.image import ImageParams, compress, gen_geotiff
from loopy.sample import Sample
from loopy.utils import Url


def run_image(
    tiff: Path,
    out: Path | None = None,
    channels: str | None = None,
    quality: int = 90,
    scale: float = 1,
    translate: tuple[float, float] = (0, 0),
) -> None:
    s = tiff.stem
    if not tiff.exists():
        raise FileNotFoundError(tiff)

    if out is None:
        out = tiff.parent

    if tiff.suffix != ".tif" and tiff.suffix != ".tiff":
        raise ValueError("Input file must be a tiff.")

    img = tifffile.imread(tiff)

    n_img_chan = 1 if len(img.shape) == 2 else min(img.shape[0], img.shape[2])

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
                        raise ValueError(
                            "Channel names must be alphanumeric. No spaces or special characters."
                        )
                except ModuleNotFoundError:
                    raise ModuleNotFoundError(
                        "Windows users: please install windows-curses with `pip install windows-curses`."
                    )
                if len(d) > 255:
                    raise ValueError("Channel names must be less than 256 characters.")

            if len(c) != n_img_chan:
                raise ValueError(
                    f"Number of channels does not match that of the image. Given {len(c)}, expected {n_img_chan}."
                )

    output = [Url(f"{s}.tif")] if n_img_chan < 4 else [Url(f"{s}_1.tif"), Url(f"{s}_2.tif")]

    sample = Sample(
        name=s,
        imgParams=ImageParams(
            urls=output,
            channels=c,
            mPerPx=scale,
        ),
    )

    o = Path(out / s)
    sample.write(o / "sample.json")

    img = tifffile.imread(tiff)
    ps = gen_geotiff(img, s, out / s, scale, translate, channels == "rgb")
    print("Compressing image...")
    compress(ps, quality)
    print(f"Saved to {o.absolute()}.")
