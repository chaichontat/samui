# ➰ Loopy Browser

[![Run Data Prep Workflow](https://github.com/chaichontat/loopy-browser/actions/workflows/data_prep.yml/badge.svg?branch=main)](https://github.com/chaichontat/loopy-browser/actions/workflows/data_prep.yml)

Loopy Browser is a performant visualization tool for spatial transcriptomics experiments. The browser is available at https://loopybrowser.com. 

### Abstract 

The Loopy Browser enables performant and interactive data visualizations for high-resolution scentific images including from multiplex images or spatially-resolved transcriptomics that combines either brightfield or fluorescent high-resolution images with transcriptome-wide profiling of mRNA followed by next-generation sequencing. We demonstrate the utility of the browser as applied to data generated with the 10x Genomics Visium and the 10X Genomics Visium with immunofluorescence (Visium-IF) platforms in the dorsolateral prefrontal cortex of the human brain. 

## Usage

Head over to https://loopybrowser.com to see the Loopy Browser with example data.

## Data Preparation

All data must be processed prior to being used in the Loopy Browser.

### Installation

All of the dependencies to process the data are listed in [environment.yml](environment.yml) and will installed as part of the step below to create a new conda environment called `loopy`. However, you can install everything you need with

```sh
python       3.10
click
gdal
pydantic
rasterio
scanpy
scipy
tifffile
```

Create and activate a conda environment called `loopy`

```sh
git clone https://github.com/chaichontat/loopy-browser/
conda env create -n loopy -f loopy-browser/environment.yml
conda activate loopy
conda install jupyter jupyterlab
pip install ./loopy-browser
```

### Example 

We demonstrate Loopy Browser with four tissue samples measured on the 10X Genomics Visium with immunofluorescence (Visium-IF) platform.
 
Here, there are two inputs needed for each sample. 

1. The first is a directory containing output from `spaceranger`. The out directory contains folders of processed images and features. These can be fed directly to "Add samples" in the Loopy Browser.

2. The `.tif` image corresponding to the immunofluorescence image. Put the image file in the directory folder with the same name as that of the sample. For example, if the spaceranger output folder is named Br2720_Ant_IF, the image should be name Br2720_Ant_IF.tif and placed outside the spaceranger folder.

```sh
foobar data directory  |-- Br2720_Ant_IF/  |  o-- object of type(s):dir  |-- Br2720_Ant_IF.tif  |  o-- object of type(s):file  |-- Br6432_Ant_IF/  |  o-- object of type(s):dir  |-- Br6432_Ant_IF.tif  |  o-- object of type(s):file  |-- Br6522_Ant_IF/  |  o-- object of type(s):dir  |-- Br6522_Ant_IF.tif  |  o-- object of type(s):file  |-- Br8667_Post_IF/  |  o-- object of type(s):dir  o-- Br8667_Post_IF.tif     o-- object of type(s):file
```

Once the data directory is prepared, an example script to preprocess data is available at [`scripts/run_sample.ipynb`](scripts/run_sample.ipynb).
This is run using a Jupyter notebook. To start, run `jupyter lab` at the cloned directory.

## Nomenclature

Being compatible with static hosting, there are multiple layers of data.

- `sample.json`: this contains the overall detail of the sample, such as its names and list of features.
- `{features}.json`: these are either headers for `ChunkedJSON` or headers and data for `PlainJSON`.

## Citation 

Please use this citation for Loopy Browser: 

Add citation to once preprint is posted.