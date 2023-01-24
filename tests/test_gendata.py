import subprocess
from pathlib import Path

from pydantic import parse_file_as
from validate_cloud_optimized_geotiff import validate

from loopy.sample import Sample
from loopy.utils.utils import download


def test_gendata():
    download("https://libd-spatial-dlpfc-loopy.s3.amazonaws.com/VisiumIF/sample.tif", Path("sample.tif"))

    subprocess.run(
        "loopy image -o testout -s 0.497e-6 -c Lipofuscin,DAPI,GFAP,NeuN,OLIG2,TMEM119 sample.tif".split(" "),
        check=True,
    )

    out = Path("testout")
    out = out / "sample"
    assert (out / "sample_1.tif").exists()
    assert (out / "sample_2.tif").exists()
    assert not validate((out / "sample_1.tif").as_posix(), full_check=True)[0]  # No errors
    assert not validate((out / "sample_2.tif").as_posix(), full_check=True)[0]
    assert parse_file_as(Sample, out / "sample.json")
