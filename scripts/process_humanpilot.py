#%%
import hashlib
import json
import zipfile
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from shutil import copy

import from_spaceranger as fs
import pandas as pd
import requests

from loopy.logger import log, setup_logging

setup_logging()


def check_md5(path: Path, md5: str) -> bool:
    with open(path, "rb") as f:
        return hashlib.md5(f.read()).hexdigest() == md5


def download(url: str, path: Path, md5: str) -> None:
    if path.exists() and check_md5(path, md5):
        log(f"Skipping {path}...")
        return

    r = requests.get(url, stream=True)
    with open(path, "wb") as f:
        for chunk in r.iter_content(chunk_size=1024):
            if chunk:
                f.write(chunk)


#%%
# Cloned repo from https://github.com/LieberInstitute/HumanPilot/
tempdir = Path("./temp")
tempdir.mkdir(exist_ok=True, parents=True)
log(f"Downloading HumanPilot to {tempdir}...")
download(
    "https://github.com/LieberInstitute/HumanPilot/archive/89e9002790a8b78c8c7ce06f5331809626386fd5.zip",
    tempdir / "HumanPilot.zip",
    "f051f97b567444311769c67913261e1f",
)
with zipfile.ZipFile(tempdir / "HumanPilot.zip", "r") as zip_ref:
    zip_ref.extractall(tempdir)
humanpilot = tempdir / "HumanPilot-master"

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
for sample in samples:
    name = sample["name"]
    log(f"Downloading {name}...")
    download(
        f"https://spatial-dlpfc.s3.us-east-2.amazonaws.com/h5/{name}_filtered_feature_bc_matrix.h5",
        datadir / f"{name}_filtered_feature_bc_matrix.h5",
        sample["h5md5"],
    )
    download(
        f"https://spatial-dlpfc.s3.us-east-2.amazonaws.com/images/{name}_full_image.tif",
        datadir / f"{name}_full_image.tif",
        sample["imgmd5"],
    )

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
        for sample in samples
    ]
    for future in as_completed(futures):
        future.result()

#%%
# Add features
for clustering in (humanpilot / "outputs" / "SpatialDE_clustering").iterdir():
    sample = clustering.stem.split("_")[-1]
    pd.read_csv(clustering).drop(columns=["key"]).to_csv(outdir / sample / "clustering.csv", index=False)

# Layer guesses
def join_guesses(template: Path, guess: Path):
    df = pd.read_csv(guess)
    df.set_index("spot_name", inplace=True)
    pd.read_csv(template).join(df, on="id")["layer"].fillna("Unlabeled").to_csv(
        template.parent / "layers.csv", index=False
    )


guesses = list((humanpilot / "Analysis" / "Layer_Guesses" / "First_Round").iterdir()) + list(
    (humanpilot / "Analysis" / "Layer_Guesses" / "Second_Round").iterdir()
)
for sample in samples:
    for guess in guesses:
        if sample in guess.name:
            join_guesses(outdir / sample / "spotCoords.csv", guess)
            break
    else:
        print(f"Could not find layer guesses for {sample}")

#%%
# Edit sample.json
for sample in samples:
    s = json.loads((outdir / sample / "sample.json").read_text())
    if len(s["featParams"]) == 1:  # Idempotent
        s["featParams"].append(
            dict(
                type="plainCSV",
                name="clustering",
                url={"url": "clustering.csv", "type": "local"},
                dataType="categorical",
                coordName="spots",
            )
        )
        s["featParams"].append(
            dict(
                type="plainCSV",
                name="layers",
                url={"url": "layers.csv", "type": "local"},
                dataType="categorical",
                coordName="spots",
            )
        )

    s["overlayParams"] = {
        "defaults": [{"feature": "ground_truth", "group": "clustering"}],
        "importantFeatures": [
            {"feature": "GFAP", "group": "genes"},
            {"feature": "OLIG2", "group": "genes"},
            {"feature": "TMEM119", "group": "genes"},
            {"feature": "RBFOX3", "group": "genes"},
        ],
    }

    (outdir / sample / "sample.json").write_text(json.dumps(s))

# %%
