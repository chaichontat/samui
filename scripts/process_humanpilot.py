#%%
import json
from concurrent.futures import ProcessPoolExecutor, as_completed
from pathlib import Path
from shutil import copy

import from_spaceranger as fs
import pandas as pd

# Cloned repo from https://github.com/LieberInstitute/HumanPilot/
humanpilot = Path("C:\\Users\\Chaichontat\\GitHub\\HumanPilot")

# Downloaded `h5_filtered` and `image_full` from https://github.com/LieberInstitute/HumanPilot#raw-data
datadir = Path("C:\\Users\\Chaichontat\\Downloads")

# Output directory
outdir = Path("./out")

tempdir = Path("./temp")

outdir.mkdir(exist_ok=True, parents=True)
samples = []

# Reformat files back into spaceranger format
for folder in (humanpilot / "10X").iterdir():
    if not folder.is_dir() or not folder.name.isdigit():
        continue

    name = folder.name
    samples.append(name)
    print(name)
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
with ProcessPoolExecutor(max_workers=8) as pool:
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
