#%%
from concurrent.futures import ProcessPoolExecutor, ThreadPoolExecutor
from pathlib import Path
from typing import Literal, cast

from scanpy import read_visium
from tifffile import imread

import gengene
import gentiff
import genvisium

directory = Path("E:/Lab/VIF")
out = Path("E:/Lab/VIF/out")
samples = [
    "Br2720_Ant_IF",
    "Br6432_Ant_IF",
    "Br6522_Ant_IF",
    "Br8667_Post_IF"
]

channels = {
    "Lipofuscin": 1,
    "DAPI": 2,
    "GFAP": 3,
    "NeuN": 4,
    "OLIG2": 5,
    "TMEM119": 6,
}

def run(s: str) -> None:
    vis = read_visium(directory / s)
    vis.var_names_make_unique()
    o = Path(out / s)
    o.mkdir(exist_ok=True, parents=True)

    for orient in ["csr", "csc"]:
        header, bytedict = gengene.get_compressed_genes(vis, cast(Literal["csc", "csr"], orient), include_name=(orient == "csc"))
        (o / f"gene_{orient}.json").write_text(header.json().replace(" ", ""))
        (o / f"gene_{orient}.bin").write_bytes(bytedict)

    (o / "image.json").write_text(genvisium.get_img_metadata(vis, s, channels).json().replace(" ", ""))
    img = imread(directory / (s+".tif") )
    tifs = gentiff.gen_geotiff(img, o / s)
    gentiff.compress(tifs)


for s in samples:
    run(s)
# with ProcessPoolExecutor(max_workers=2) as executor:
    # executor.map(run, samples)



# %%
