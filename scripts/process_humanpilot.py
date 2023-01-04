#%%
import hashlib
import zipfile
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from shutil import copy

import from_spaceranger as fs
import pandas as pd
import requests

from loopy.logger import log, setup_logging
from loopy.sample import Sample

setup_logging()


def check_md5(path: Path, md5: str) -> bool:
    with open(path, "rb") as f:
        return hashlib.md5(f.read()).hexdigest() == md5


def download(url: str, path: Path, md5: str) -> None:
    if path.exists() and check_md5(path, md5):
        log(f"Skipping {path}...")
        return

    log(f"Downloading {url}...")
    r = requests.get(url, stream=True)
    with open(path, "wb") as f:
        for chunk in r.iter_content(chunk_size=1024):
            if chunk:
                f.write(chunk)


#%%
# Cloned repo from https://github.com/LieberInstitute/HumanPilot/
tempdir = Path("./temp")
tempdir.mkdir(exist_ok=True, parents=True)
log(f"Downloading the HumanPilot repo to {tempdir.absolute()}...")
download(
    "https://github.com/LieberInstitute/HumanPilot/archive/89e9002790a8b78c8c7ce06f5331809626386fd5.zip",
    tempdir / "HumanPilot.zip",
    "1ace2c10447343e23cba35ac9709a7c3",
)
with zipfile.ZipFile(tempdir / "HumanPilot.zip", "r") as zip_ref:
    zip_ref.extractall(tempdir)
humanpilot = tempdir / "HumanPilot-89e9002790a8b78c8c7ce06f5331809626386fd5"

# Download sample h5_filtered and images.
samples = [
    dict(name="151507", h5md5="2e6fc8a20a75c527bc4b0432712d6d9b", imgmd5="da90a9e0d57cb8b9ebe3c7509a52e9bc"),
    dict(name="151508", h5md5="b3b8b75851e29564303485ff7b523826", imgmd5="f74004e303248216a796a24ac6fb2802"),
    dict(name="151509", h5md5="fc4d857e07bca429442c68d9c6b8e7cd", imgmd5="71ac22dde6b5f8ebded19ad1edc58bc3"),
    dict(name="151510", h5md5="0f94f7fa5c50932f8ed9f653fd53b401", imgmd5="8c35343fea8bcffb81d706e53651ad0d"),
    dict(name="151669", h5md5="ec82054132e340b43c33f12df7004a51", imgmd5="a8dc901443e2bb133205a484cf90f89a"),
    dict(name="151670", h5md5="8ed6d0e7a49003119934dfea3fd63c6a", imgmd5="5de9715db2802d6ddcb753156e56c6ab"),
    dict(name="151671", h5md5="3e236f9ee65b74ff4c4e6f9afeafbeb1", imgmd5="ebd074b4fbf2c79ecfdf6b486b74fb67"),
    dict(name="151672", h5md5="a560695939bb3ad2785640cb8f40aaed", imgmd5="621a8a5c16dfef2cccc1557658e5924c"),
    dict(name="151673", h5md5="0ba89021d9c9fa03eed3b814e6c99a16", imgmd5="2f32e7e6c9955e09ef0e291a4b1e0105"),
    dict(name="151674", h5md5="779c5e1414268a6fb1037cc3587cd3e1", imgmd5="3e681c37f2a4b3aa343f133ff09c380d"),
    dict(name="151675", h5md5="2e08d7777b104538a8ecbbe939a858af", imgmd5="d937e24ffeb703a901df382e0417d2bc"),
    dict(name="151676", h5md5="9419abdf5f81bbcade16946e9fb8ca0f", imgmd5="c8f2e904001db9c821f9bbcc8e65e6ea"),
]

# Downloaded `h5_filtered` and `image_full` from https://github.com/LieberInstitute/HumanPilot#raw-data
datadir = tempdir


def download_sample(s: dict[str, str]):
    name = s["name"]
    download(
        f"https://spatial-dlpfc.s3.us-east-2.amazonaws.com/h5/{name}_filtered_feature_bc_matrix.h5",
        datadir / f"{name}_filtered_feature_bc_matrix.h5",
        s["h5md5"],
    )
    download(
        f"https://spatial-dlpfc.s3.us-east-2.amazonaws.com/images/{name}_full_image.tif",
        datadir / f"{name}_full_image.tif",
        s["imgmd5"],
    )


with ThreadPoolExecutor(max_workers=6) as executor:
    executor.map(download_sample, samples)

#%%
# Output directory
outdir = Path("./out")
outdir.mkdir(exist_ok=True, parents=True)
samples = []

# Reformat files back into spaceranger format
for folder in (humanpilot / "10X").iterdir():
    if not folder.is_dir() or not folder.name.isdigit():
        continue

    name = folder.name
    samples.append(name)
    o = Path(tempdir / name) / "outs"
    o.mkdir(exist_ok=True, parents=True)
    spatial = o / "spatial"
    spatial.mkdir(exist_ok=True, parents=True)

    for file in folder.iterdir():
        match file.name:
            case n if "web_summary" in n:
                copy(file, o / "web_summary.html")
            case "metrics_summary_csv.csv":
                copy(file, o / "metrics_summary.csv")
            case "tissue_positions_list.txt":
                copy(file, spatial / "tissue_positions_list.csv")
            case _:
                copy(file, spatial)

    copy(datadir / f"{name}_filtered_feature_bc_matrix.h5", o / "filtered_feature_bc_matrix.h5")

#%%
log("Converting spaceranger data and images to GeoTIFF.")
sample_objs: dict[str, Sample] = dict()
# Using ThreadPoolExecutor instead of ProcessPoolExecutor to avoid problems with different forking strategies.
with ThreadPoolExecutor(max_workers=4) as pool:
    futures = [
        pool.submit(
            fs.run_spaceranger,
            name=sample,
            path=tempdir,
            tif=datadir / f"{sample}_full_image.tif",
            out=outdir,
            channels="rgb",
        )
        for sample in samples[:1]
    ]
    for future in as_completed(futures):
        res = future.result()
        sample_objs[res.name] = res

#%%
# Add features
# - Clusters
# - Layer guesses

# Head of the clusters file
# "key","ground_truth","SpatialDE_PCA","SpatialDE_pool_PCA","HVG_PCA","pseudobulk_PCA","markers_PCA","SpatialDE_UMAP","SpatialDE_pool_UMAP","HVG_UMAP","pseudobulk_UMAP","markers_UMAP","SpatialDE_PCA_spatial","SpatialDE_pool_PCA_spatial","HVG_PCA_spatial","pseudobulk_PCA_spatial","markers_PCA_spatial","SpatialDE_UMAP_spatial","SpatialDE_pool_UMAP_spatial","HVG_UMAP_spatial","pseudobulk_UMAP_spatial","markers_UMAP_spatial"
# "151507_AAACAACGAATAGTTC-1","Layer_1",4,5,3,5,4,1,2,1,3,1,3,5,5,4,3,1,1,1,1,1
# "151507_AAACAAGTATCTCCCA-1","Layer_3",2,3,1,2,2,1,3,1,2,1,4,1,2,3,1,2,2,1,2,1
# "151507_AAACAATCTACTAGCA-1","Layer_1",4,4,4,4,8,2,4,5,3,6,3,4,3,5,7,2,1,4,1,6
# ...

# Head of layer guesses file
# "sample_name","spot_name","layer"
# 151507,"AAACAACGAATAGTTC-1","Layer 1"
# 151507,"AAACAAGTATCTCCCA-1","Layer 3"
# 151507,"AAACAATCTACTAGCA-1","Layer 1"

guesses = list((humanpilot / "Analysis" / "Layer_Guesses" / "First_Round").iterdir()) + list(
    (humanpilot / "Analysis" / "Layer_Guesses" / "Second_Round").iterdir()
)

for name, s in sample_objs.items():
    df = pd.read_csv(humanpilot / "outputs" / "SpatialDE_clustering" / f"cluster_labels_{name}.csv")
    df["key"] = df["key"].map(lambda x: x.split("_")[1])
    df.set_index("key", inplace=True)
    s.add_csv_feature(df, name="clustering", coordName="spots", dataType="categorical")

    for guess in guesses:
        if name in guess.name:
            df = pd.read_csv(guess).drop(columns=["sample_name"])
            df.set_index("spot_name", inplace=True)
            s.add_csv_feature(df, name="guesses", coordName="spots", dataType="categorical")
            break
    else:
        print(f"Could not find layer guesses for {name}")

    s.set_default_feature(group="clustering", feature="ground_truth")
    s.write()

# %%
