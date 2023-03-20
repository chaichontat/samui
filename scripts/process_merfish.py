#%%
import shutil
from pathlib import Path

import numpy as np
import pandas as pd
from rasterio import Affine

from loopy.sample import Sample
from loopy.utils.utils import remove_dupes

#%%
# You need to download the data from https://info.vizgen.com/mouse-brain-data
# which, for each slice, contains the following files:
#   cell_boundaries/
#   cell_by_gene_S{n}R{n}.csv
#   cell_metadata_S{n}R{n}.csv
#   detected_transcripts_S1R1.csv
#   images/
#   |- micron_to_mosaic_pixel_transform.csv
#   |- mosaic_DAPI_z{n}.tif
#
# where {n} is a number.
# This script expects these files in a single directory (use one DAPI file).
# Note that we need to convert the uint16 format in of the DAPI image to uint8
# for the compression.
# This requires a huge amount of memory since each image is 10.2 GB.
# To download data from Google Cloud in the command line, use [gsutil](https://cloud.google.com/storage/docs/downloading-objects).

sample_dir = Path("/Users/chaichontat/Downloads/trs")
# dapi = (
#     sample_dir / "datasets-mouse_brain_map-BrainReceptorShowcase-Slice1-Replicate1-images-mosaic_DAPI_z0.tif"
# )

#%% Coords
coords = remove_dupes(
    pd.read_csv(sample_dir / "cell_metadata.csv", index_col=0, dtype=np.float32).rename(
        columns={"center_x": "x", "center_y": "y"}
    )[["x", "y"]]
)

coords.index = coords.index.map("{:.0f}".format)

feat = remove_dupes(
    pd.read_csv(
        sample_dir / "cell_by_gene.csv",
        index_col=0,
        dtype=np.float32,
    )
).apply(lambda x: np.log2(x + 1), raw=True, axis=0)
feat.index = feat.index.map("{:.0f}".format)

shutil.rmtree(sample_dir / "out_image", ignore_errors=True)
# This creates a new sample that has only spots.
s = (
    Sample(name="sample", path=sample_dir / "out")
    # You may need to adjust the size to make the spot size more reasonable.
    .add_coords(coords, name="cellCoords", mPerPx=1e-6, size=1e-5).add_chunked_feature(
        feat, name="cells", coordName="cellCoords", unit="Log counts", sparse=True
    )
    # .set_default_feature(group="cells", feature="Oxgr1") # Example: this needs to match a feature that exists in your sample.
    .write()
)

# You can drag the result in the out folder to Samui to see your spots.

# %%
# Next, we will add the image to the sample.
# This requires alignment from the spot coordinates to the image coordinates.

# Affine matrix
scale = np.loadtxt(sample_dir / "micron_to_mosaic_pixel_transform.csv")
# Inverse transform
affine = ~Affine(*scale[:2].flatten() * 1e6)
dapi = sample_dir / "mosaic_Cellbound1_z1.tif"

# Make another sample that has an image.
shutil.rmtree(sample_dir / "out_image", ignore_errors=True)
shutil.copytree(sample_dir / "out", sample_dir / "out_image")
s.set_path(sample_dir / "out_image")

#%%
s.add_image(dapi, channels=["DAPI"], scale=affine.a, translate=(affine.c * 1e-6, affine.f * 1e-6)).write()

# %%
