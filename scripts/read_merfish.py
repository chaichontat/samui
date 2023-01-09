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

sample_dir = Path(r"C:\Users\Chaichontat\GitHub\loopynew\static")
out = Path("./BrainReceptorShowcase_Slice1_Replicate1")
dapi = sample_dir / "dapi_uint8.tif"

cell_by_gene = (
    sample_dir / "datasets-mouse_brain_map-BrainReceptorShowcase-Slice1-Replicate1-cell_by_gene_S1R1.csv"
)

cell_metadata = (
    sample_dir / "datasets-mouse_brain_map-BrainReceptorShowcase-Slice1-Replicate1-cell_metadata_S1R1.csv"
)

# Affine matrix
scale = np.loadtxt(
    sample_dir
    / "datasets_mouse_brain_map_BrainReceptorShowcase_Slice1_Replicate1_images_micron_to_mosaic_pixel_transform.csv"
)

#%% Coords
coords = remove_dupes(
    pd.read_csv(cell_metadata, index_col=0, dtype=np.float32).rename(
        columns={"center_x": "x", "center_y": "y"}
    )[["x", "y"]]
)

coords.index = coords.index.map("{:.0f}".format)


# Inverse transform
scalenew = scale.copy()
scalenew[:2, :2] *= 1e6
affine = ~Affine(*scalenew[:2].flatten())

feat = remove_dupes(
    pd.read_csv(
        cell_by_gene,
        index_col=0,
        dtype=np.float32,
    )
).apply(lambda x: np.log2(x + 1), raw=True, axis=0)
feat.index = feat.index.map("{:.0f}".format)

s = (
    Sample(name="BrainReceptorShowcase1", path=out)
    .add_coords(coords, name="cellCoords", mPerPx=1e-6, size=2e-5)
    .add_chunked_feature(feat, name="cells", coordName="cellCoords", unit="Log counts", sparse=True)
    # .do_not_execute_previous()
    .add_image(
        dapi, channels=["DAPI"], scale=affine.a, translate=(affine.c, affine.f), save_uncompressed=True
    )
    # .do_not_execute_previous()
    .set_default_feature(group="cells", feature="Oxgr1")
    .write()
)


# %%
