from pathlib import Path

from pydantic import parse_file_as

from loopy.run_image import run_image
from loopy.sample import Sample


def test_gendata():
    out = Path("testout")
    run_image(
        Path("sample.tif"),
        out,
        scale=0.497e-6,
        channels=",".join(["Lipofuscin", "DAPI", "GFAP", "NeuN", "OLIG2", "TMEM119"]),
    )

    out = out / "sample"
    assert (out / "sample_1.tif").exists()
    assert (out / "sample_2.tif").exists()
    assert parse_file_as(Sample, out / "sample.json")
