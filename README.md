# ➰ Loopy Browser

[![Run Data Prep Workflow](https://github.com/chaichontat/loopy-browser/actions/workflows/data_prep.yml/badge.svg?branch=main)](https://github.com/chaichontat/loopy-browser/actions/workflows/data_prep.yml)

Loopy Browser is a performant visualization tool for spatial transcriptomics experiments.

## Usage

Head over to https://loopybrowser.com/ to see the Loopy Browser with example Visium-IF data.

You need to preprocess your image to form a tiled structure prior to being used in the Loopy Browser.

### Preprocessing

Download a sample TIFF image from https://data.loopybrowser.com/VisiumIF/sample.tif.
The preprocessing system can be installed as described [below](#Installation).
Call the preprocessing GUI with the following command in the terminal.

#### GUI

```sh
conda activate loopy
loopy gui
```

<img width="712" alt="Loopy preprocessing" src="https://user-images.githubusercontent.com/34997334/193870809-5338cbfa-9d7d-4e12-aca7-8a2c149eb2a2.png">

#### In the command line

```sh
conda activate loopy
loopy image [PATH TO IMAGE] --scale 0.497e-6 --channels Lipofuscin,DAPI,GFAP,NeuN,OLIG2,TMEM119
```

In this case, the output folder has the same name as the input file.

You can drag this folder directly to https://loopybrowser.com/.
Despite the Browser being a webpage, all data are processed locally on your computer.

**This link opens the expected result: https://loopybrowser.com/from?url=libd-spatial-dlpfc-loopy.s3.amazonaws.com/VisiumIF/&s=sample.**

Here, the browser retrieves the processed folder hosted on an external server.
You could share your files with your collaborators using your own file server or AWS S3.
More reasonably priced alternatives include [Cloudflare R2](https://www.cloudflare.com/products/r2/) and [Backblaze B2](https://www.backblaze.com/b2/cloud-storage.html).
The images are available instantly and without any installation on their end!

### Sample viewing

Loopy allows for viewing multiple samples simultaneously using the "split vertical" or "split horizontal" buttons located next to the sample ID pane.
Loopy also allows for viewing multiple fluorescent image channels that can be toggled on and off in the window below the sample ID pane.
Each channel can be adjusted individually for color and maximum intensity.
Users can zoom in/out using a mouse wheel and can navigate around the sample by clicking and dragging.
Menus can be hidden using the show/hide button to view more of the sample.
A screenshot can also be acquired using the camera button. 

### Layers

Layers can be added using "+ Add Layer" button.
For example, in Visium data, each queried gene can be added as a layer.
The check boxes next to a feature display the border and fill of the spot (Visium) or segmented cell (MERFISH). 


### Annotation

There are two separate types of annotations in Loopy Browser: 

- ROI annotation
- feature annotation

Generally, ROI annotation is used for images and feature annotation is used for Visium spots, segmented cells, etc. 
You can only work with one type of annotation at a time (i.e. you cannot annotate both ROIs and features at the same time).
The feature you are trying to annotate must be consistent with the overlay loaded (i.e. if you would like to annotate Visium spots you must be viewing an overlay of gene expression and not an overlay of individual cells segmented from the image).
Before annotation, you must set a label first using "+ Label".
After creation, the labels can be changed by double-clicking on the label names.
You are actively annotating with a given label when it is bold.
You must select the STOP button to end annotation with the active label before creating a new label or attempting to annotate with a different label.
There are 3 tool options for annotating: _polygon_, _circle_, and _select_ tools.
Annotated features are outlined in the assigned color when they have been given a label.
Colors cannot be changed.
The overlay can be toggled on and off using "show overlay."
Annotations can be deleted using the DELETE key on the keyboard.
The ESC key can be used to exit out of an active annotation. 

#### ROI Annotation

This is the typical kind of annotation you would expect from other image viewers.
We simply draw figures that indicate regions of interest of the image.
The exported result is a JSON file that contains the coordinates of the drawn figures.
That is, the outputs are _coordinates and their labels_.
The exported results can be dragged back into the browser.

#### Feature Annotation

Here, we annotate the features or overlays that are either with the dataset to begin with or imported.
Examples of features include gene expression, cell segmentation, spot deconvolution results (Visium). 
The ability to draw ROIs is simply there to facilitate annotation, but each point can be annotated individually as well.
Following annotation, the outputs are _feature ID and their labels_.
The exported results can be dragged back into the browser.


### Example data 

#### Visium data

For Visium a tissue section is placed on a patterned array of spots, and gene expression is measured in each spot.
The morphology of the tissue section is visualized with hemotoxylin and eosin staining, which is imaged and aligned with gene expression data mapping to individual spots.
Using the search bar, you can search for individual genes (e.g. SNAP25, GFAP, MOBP) to display their gene expression (logcounts) in Visium spots across the tissue.
Density plots are also depicted on the search window and are interactive with polygon annotation (see below).
Note, genes are one type of feature category.
If cell segmentation or spot deconvolution data are imported, these represent separate feature categories. 

#### MERFISH data

Need to add here.


## Installation

Install [`conda`](https://github.com/conda-forge/miniforge#miniforge3). These video guides can be helpful: [Mac](https://www.youtube.com/watch?v=328DQUWZP48) and [Windows](https://www.youtube.com/watch?v=-H_onyfW9VE). Then, in the Terminal, run

```sh
git clone https://github.com/chaichontat/loopy-browser/
cd loopy-browser
conda env create -n loopy -f environment.yml
```

## Nomenclature

Being compatible with static hosting, Loopy Browser has most of its data all precomputed.

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
