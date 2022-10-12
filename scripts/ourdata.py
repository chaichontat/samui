#%%
from pathlib import Path

from loopy.feature import FeatureAndGroup

#%%
directory = Path("C:/Users/Chaichontat/Documents/VIF")
out = Path("C:/Users/Chaichontat/GitHub/loopynew/static")
samples = ["Br2720_Ant_IF", "Br6432_Ant_IF", "Br6522_Ant_IF", "Br8667_Post_IF"]

channels = [
    "Lipofuscin",
    "DAPI",
    "GFAP",
    "NeuN",
    "OLIG2",
    "TMEM119",
]

importantFeatures=[
                FeatureAndGroup(feature="GFAP", group="genes"),
                FeatureAndGroup(feature="OLIG2", group="genes"),
                FeatureAndGroup(feature="TMEM119", group="genes"),
                FeatureAndGroup(feature="RBFOX3", group="genes"),
            ],
            defaults=[
                FeatureAndGroup(feature="GFAP", group="genes"),
            ],

for s in samples:
    so = run_spaceranger(
        directory / s,
        directory / (s + ".tif"),
        out,
        defaultChannels=dict(blue="DAPI", green="GFAP", red="NeuN"),
        mPerPx=0.497e-6,
        spotDiam=130e-6,
    )


# %%
out = Path("C:/Users/Chaichontat/GitHub/loopynew/static")
samples = ["Br2720_Ant_IF", "Br6432_Ant_IF", "Br6522_Ant_IF", "Br8667_Post_IF"]
for s in samples:
    (out / s / f"{s}_filtered.csv").rename(out / s / "cellsFiltered.csv")
    (out / s / f"{s}_unfiltered.csv").rename(out / s / "cellsUnfiltered.csv")
# %%


# %%


# %%
u = TiffFile(directory / (samples[0] + ".tif"))

# %%
#             PlainCSVParams(
#                 name="cellType", url=Url("cellType.csv"), dataType="categorical", coordName="cells"
#             ),
# PlainCSVParams(
#     name="cellsFiltered", url=Url("cellsFiltered.csv"), dataType="quantitative", size=10e-6
# ),
# PlainCSVParams(
#     name="cellsUnfiltered", url=Url("cellsUnfiltered.csv"), dataType="quantitative", size=10e-6
# ),
#             CoordParams(name="cells", shape="circle", mPerPx=mPerPx, url=Url("cellCoords.csv")),
# OverlayParams(
#             importantFeatures=[
#                 FeatureAndGroup(feature="GFAP", group="genes"),
#                 FeatureAndGroup(feature="OLIG2", group="genes"),
#                 FeatureAndGroup(feature="TMEM119", group="genes"),
#                 FeatureAndGroup(feature="RBFOX3", group="genes"),
#             ],
#             defaults=[
#                 FeatureAndGroup(feature="GFAP", group="genes"),
#             ],
#         ),
