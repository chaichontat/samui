from pathlib import Path

from loopy.sample import Sample

# From https://libd-spatial-dlpfc-loopy.s3.amazonaws.com/VisiumIF/sample.tif
tiff = Path("sample.tif")
name = "sample"
out = Path("testout")
c = "Lipofuscin,DAPI,GFAP,NeuN,OLIG2,TMEM119".split(",")
scale = 0.497e-6
quality = 90

Sample(name=name, path=out).add_image(tiff, channels=c, scale=scale, quality=quality).write()
