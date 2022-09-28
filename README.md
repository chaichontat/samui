# ➰ Loopy Browser

[![Run Data Prep Workflow](https://github.com/chaichontat/loopy-browser/actions/workflows/data_prep.yml/badge.svg?branch=main)](https://github.com/chaichontat/loopy-browser/actions/workflows/data_prep.yml)

Loopy Browser is a performant visualization tool for spatial transcriptomics experiments.

## Usage

Head over to https://loopybrowser.com/ to see the Loopy Browser with example Visium-IF data.

You need to preprocess an image prior to being used in the Loopy Browser.
See the preprocessing package installation details below.

### Example Preprocessing

Download a sample TIFF image from https://data.loopybrowser.com/VisiumIF/sample.tif.

```sh
conda activate loopy
loopy [PATH TO IMAGE] --scale 0.497e-6 --channels Lipofuscin,DAPI,GFAP,NeuN,OLIG2,TMEM119
```

The output folder has the same name as the input file.
You can drag this folder to https://loopybrowser.com/.
Despite the Browser being a webpage, all data are processed locally on your computer.

## Installation

```sh
git clone https://github.com/chaichontat/loopy-browser/
cd loopy-browser
conda env create -n loopy -f environment.yml
```


## Nomenclature

Being compatible with static hosting, there are multiple layers of data.

- `sample.json`: this contains the overall detail of the sample, such as its names and list of features.
- `{features}.json`: these are either headers for `ChunkedJSON` or headers and data for `PlainJSON`.

```mermaid
graph LR
    subgraph Sample
    Overlay1 --> Feature1
    Overlay1 --> Feature2
    subgraph FeatureGroup
        Feature1
        Feature2
    end
    Overlay1 --> Feature3
    Overlay2 --> Feature4
    end
 ```
