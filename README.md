# 🏝️ Samui

[![DOI](https://zenodo.org/badge/482243832.svg)](https://zenodo.org/badge/latestdoi/482243832)

[![Run HumanPilot Workflow](https://github.com/chaichontat/samui/actions/workflows/humanpilot.yml/badge.svg)](https://github.com/chaichontat/samui/actions/workflows/humanpilot.yml)

Samui (named for an island located in Gulf of Thailand Ko Samui pronounced gaw -- rhyming with raw -- sà mui) is a performant visualization tool for spatial transcriptomics experiments.

**Preprint available now!** [Performant web-based interactive visualization tool for spatially-resolved transcriptomics experiments](https://www.biorxiv.org/content/10.1101/2023.01.28.525943v2).

## Usage

Head over to <https://samuibrowser.com/> to see Samui with example Visium-IF data.

You need to preprocess your image to form a tiled structure prior to being used in the Samui.

## Installation

Install [`conda`](https://github.com/conda-forge/miniforge#miniforge3). These video guides can be helpful: [Mac](https://www.youtube.com/watch?v=328DQUWZP48) and [Windows](https://www.youtube.com/watch?v=-H_onyfW9VE). Then, in the Terminal, run

```sh
git clone https://github.com/chaichontat/samui/
cd samui
conda env create -n samui -f environment.yml
```

### Serving a Sample Locally

After preprocessing, you can host a sample directory with `loopy serve` for browser access:

```sh
pip install .[server]  # installs FastAPI/Uvicorn extras if not already available
loopy serve ./out/MySample
```

The command launches a HTTP server that exposes your sample. Your browser should open up with a warning about an invalid certificate. You can safely ignore it as you're accessing your own dataset. Set `--host 0.0.0.0` when you need to reach the server from another machine on your network.

### Preprocessing

For an example case, you can download a sample TIFF image from <https://libd-spatial-dlpfc-loopy.s3.amazonaws.com/VisiumIF/sample.tif>.

#### GUI

The GUI is intended to be a simple wrapper around the Python interface and is limited to only basic options (processing spaceranger results and TIFF images).

##### Option 1: Run from Prepacked Binary

The binaries are available at [Releases](https://github.com/chaichontat/samui/releases) under `Assets`.
Windows users should download the file ending with `.exe` and macOS users should download the file ending with `.zip`, which decompresses to an executable `.app` folder.

For Mac users, you may need to right click on the app and select "Open" to bypass the security check as these binaries are not signed by Apple.

The application may take up to a minute to start up.

##### Option 2: Run from Command Line

Call the preprocessing GUI with the following command in the terminal.

```sh
conda activate samui
loopy gui
```

<img width="712" alt="Samui preprocessing" src="https://github.com/chaichontat/samui/assets/45461721/e7701fbf-7421-4668-8bd3-281ebc9d5c8c">

You can choose a TIFF file to be processed.

The `channels` field is optional. If you want to name the channels, make sure that the number of comma-separated names matches the number of channels in the image.
For the sample image, this field should be `Lipofuscin,DAPI,GFAP,NeuN,OLIG2,TMEM119`.

The output folder will have the same name as the input file and can be dragged directly to <https://samuibrowser.com/> for visualization.

#### In the command line

```sh
conda activate samui
loopy image [PATH TO IMAGE] --scale 0.497e-6 --channels Lipofuscin,DAPI,GFAP,NeuN,OLIG2,TMEM119
```

In this case, the output folder has the same name as the input file.

You can drag this folder directly to <https://samuibrowser.com/>.
Despite the Browser being a webpage, all data are processed locally on your computer.

**This link opens the expected result: <https://samuibrowser.com/from?url=libd-spatial-dlpfc-loopy.s3.amazonaws.com/VisiumIF/&s=sample>.**

Here, the browser retrieves the processed folder hosted on an external server.
You could share your files with your collaborators using your own file server or AWS S3.
More reasonably priced alternatives include [Cloudflare R2](https://www.cloudflare.com/products/r2/) and [Backblaze B2](https://www.backblaze.com/b2/cloud-storage.html).
The images are available instantly and without any installation on their end!

#### Python API

##### Overview

The main object is `Sample` from `loopy.sample`.
This is a Pydantic [model](https://docs.pydantic.dev/usage/models/) which provides nice boilerplates.

The object is chainable, which means that all methods return the object.
The methods are also lazy, which means that the actual data processing only happens when
the `write` method is called.

For example, [scripts/process_merfish.py](scripts/process_merfish.py)

```python
(
    Sample(name="BrainReceptorShowcase1", path=out)
    .add_coords(coords, name="cellCoords", mPerPx=1e-6, size=2e-5)
    .add_chunked_feature(feat, name="cells", coordName="cellCoords", unit="Log counts", sparse=True)
    .add_image(dapi, channels=["DAPI"], scale=affine.a, translate=(affine.c, affine.f))
    .set_default_feature(group="cells", feature="Oxgr1")
    .write()
)
```

This creates a sample folder that has an image along with a list of chunked features at `out/BrainReceptorShowcase1`.
This folder can be dragged directly into Samui for visualization.

##### Adding coordinates

Lets break the example above step-by-step.

Samui separates the coordinates information and the actual feature values in order to reduce data duplication.
A coordinate is a pandas DataFrame with columns `x` and `y`in meters.

| index  | x | y |
|--------|---|---|
| spot_1 | 1 | 3 |
| spot_2 | 2 | 1 |
| spot_3 | 4 | 2 |

This `coords` dataframe can be added to `Sample` with the following method call.
The index uniquely labels each spot (for Visium data).

```python
.add_coords(coords, name="cellCoords", mPerPx=1e-6, size=2e-5)
```

This creates 3  20 μm spots.

#### Adding feature information

To add features like gene expression to your `Sample`, you need to prepare the data as a pandas DataFrame. The DataFrame's index must match the index used when adding coordinates with `.add_coords()`.

| index  | gene_1 | gene_2 | gene_3 |
|--------|--------|--------|--------|
| spot_1 | 0.5    | 1.2    | 0.8    |
| spot_2 | 1.1    | 0.3    | 2.1    |
| spot_3 | 0.7    | 1.5    | 0.6    |

Each DataFrame column becomes a feature you can explore in Samui. Each row represents one spot.

For example, if you have a DataFrame called `gene_exp` for a Visium experiment, the columns are gene names and the rows are spots.

Use `.add_csv_feature` to add the feature to `Sample`.

> WHen the user loads the sample in Samui, the entire feature gets downloaded.
> To improve performance for large features (whole transcriptome), use `.add_chunked_feature`, which "chunks" the DataFrame column-by-column in sparse format.
> This way, Samui _lazily_ (only) downloads the column when the user requests that specific column.

```python
.add_chunked_feature(feat, name="cells", coordName="cellCoords", unit="Log counts", sparse=True, dataType="quantitative")
.set_default_feature(group="cells", feature="Oxgr1")
```

The `set_default_feature` method sets the feature that is automatically loaded when the user opens the sample in Samui.

##### Add image

Finally, we add the actual image. Here, `dapi` is a path to a TIFF file.

```python
.add_image(dapi, channels=["DAPI"], scale=affine.a, translate=(affine.c, affine.f))
```

The scale factor converts the pixel value to μm and `translate` tuple shifts the origin (top-left) of the image.

Finally, we call

```python
.write()
```

to write our sample.

##### Another example

Suppose we have a set of cells with metadata including cell type and their areas.
In this case, we'll start by preparing a single DataFrame called `cell_df` with columns `cell_type` and `cell_area`, whose index gives unique cell IDs (and thus rows correspond to cells).

A feature may only be quantitative or categorical, so we'll split `cell_df` into `cell_type` (categorical) and `cell_area` (quantitative) DataFrames when calling the `.add_csv_feature` method.

> Samui uses the `dataType` tag to decide whether to show a colorbar or swatches as a legend.

```python
(
sample = Sample(name="CellSet1", path=out)
    #   DataFrame 'coords' has columns 'x' and 'y' for cell coordinates, and
    #   index of cell IDs
    .add_coords(coords, name="cellCoords", mPerPx=1e-6, size=2e-5)
    #   Add "Cell Type", a categorical feature
    .add_csv_feature(cell_df.loc[:, 'cell_type'], name="Cell Type", coordName="cellCoords", dataType="quantitative")
    #   Add "Cell Area", a quantitative feature
    .add_csv_feature(cell_df.loc[:, 'cell_area'], name="Cell Area", coordName="cellCoords", dataType="categorical")
)
```

#### Hosting a Sample folder

Samui can open a link that points to a sample folder directly from a URL in this format

```
https://samuibrowser.com/from?url=[YOUR URL]&s=[SAMPLE1]&s=[SAMPLE2]
```

`YOUR URL` is the folder that contains the sample folders.
`SAMPLE1` and `SAMPLE2` are the sample folders generated from the preprocessing script earlier.
Note that the name of the sample and the name of the folder must be the same.
The link can be from a locally hosted server, or more commonly, a cloud service provider such as Amazon S3.

##### CORS Policy

You **must** set up a [CORS](https://docs.aws.amazon.com/AmazonS3/latest/userguide/cors.html) policy on your host.
This is a security policy to prevent malicious actors from access your files.
You must make an exemption for Samui to load the data.
An example configuration for Amazon S3 is given below.

```json
{
  "AllowedHeaders": ["*"],
  "AllowedMethods": ["GET", "HEAD", "OPTIONS"],
  "AllowedOrigins": ["https://samuibrowser.com/", "https://dev.samuibrowser.com/"],
  "MaxAgeSeconds": 3000
}
```

Configuration guides for other cloud service providers are available below.

- **Amazon S3**: <https://docs.aws.amazon.com/AmazonS3/latest/userguide/cors.html>
- **Cloudflare R2**: <https://developers.cloudflare.com/r2/buckets/cors>
- **Google Cloud Storage**: <https://cloud.google.com/storage/docs/using-cors>

### Sample viewing

Samui allows for viewing multiple samples simultaneously using the "split vertical" or "split horizontal" buttons located next to the sample ID pane.
Samui also allows for viewing multiple fluorescent image channels that can be toggled on and off in the window below the sample ID pane.
Each channel can be adjusted individually for color and maximum intensity.
Users can zoom in/out using a mouse wheel and can navigate around the sample by clicking and dragging.
Menus can be hidden using the show/hide button to view more of the sample.
A screenshot can also be acquired using the camera button.

### Layers

Layers can be added using "+ Add Layer" button.
For example, in Visium data, each queried gene can be added as a layer.
The check boxes next to a feature display the border and fill of the spot (Visium) or segmented cell (MERFISH).

### Annotation

There are two separate types of annotations in Samui:

- ROI annotation
- Feature annotation

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

## Nomenclature

Being compatible with static hosting, Samui has most of its data all precomputed.

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
