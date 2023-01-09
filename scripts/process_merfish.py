#%%
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

sample_dir = Path("temp")
dapi = (
    sample_dir / "datasets-mouse_brain_map-BrainReceptorShowcase-Slice1-Replicate1-images-mosaic_DAPI_z0.tif"
)

#%% Coords
coords = remove_dupes(
    pd.read_csv(sample_dir / "cell_metadata.csv", index_col=0, dtype=np.float32).rename(
        columns={"center_x": "x", "center_y": "y"}
    )[["x", "y"]]
)

coords.index = coords.index.map("{:.0f}".format)

# Affine matrix
scale = np.loadtxt(sample_dir / "micron_to_mosaic_pixel_transform.csv")
# Inverse transform
affine = ~Affine(*scale[:2].flatten() * 1e6)

feat = remove_dupes(
    pd.read_csv(
        sample_dir / "cell_by_gene.csv",
        index_col=0,
        dtype=np.float32,
    )
).apply(lambda x: np.log2(x + 1), raw=True, axis=0)
feat.index = feat.index.map("{:.0f}".format)

s = (
    Sample(name="BrainReceptorShowcase1", path=Path("./BrainReceptorShowcase1"))
    .add_coords(coords, name="cellCoords", mPerPx=affine.a, size=2e-6)
    .add_chunked_feature(feat, name="cells", coordName="cellCoords", unit="Log counts", sparse=True)
    .add_image(dapi, channels=["DAPI"], scale=affine.a, translate=(affine.c, affine.f))
    .set_default_feature(group="cells", feature="Oxgr1")
    .write()
)


# %%
