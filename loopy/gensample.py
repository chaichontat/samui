#%%
from pathlib import Path

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

for s in samples:
    vis = read_visium(directory / s)
    vis.var_names_make_unique()

    header, csc = gengene.get_compressed_genes(vis)
    o = Path(out / s)
    o.mkdir(exist_ok=True, parents=True)

    (o / "header.json").write_text(header.json().replace(" ", ""))
    (o / "genes.bin").write_bytes(csc)
    (o / "image.json").write_text(genvisium.get_img_metadata(vis, s, channels).json().replace(" ", ""))
    img = imread(directory / (s+".tif") )
    tifs = gentiff.gen_geotiff(img, o / s)
    gentiff.compress(tifs)
