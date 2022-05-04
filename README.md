# ➰ Loopy Browser

[![Run Data Prep Workflow](https://github.com/chaichontat/loopy-browser/actions/workflows/data_prep.yml/badge.svg?branch=main)](https://github.com/chaichontat/loopy-browser/actions/workflows/data_prep.yml)

Loopy Browser is a performant visualization tool for spatial transcriptomics experiments.

## Usage

Head over to https://loopy-browser.pages.dev/ to see the Loopy Browser with example data.

## Data Preparation

All data must be processed prior to being used in the Loopy Browser.

```sh
git clone https://github.com/chaichontat/loopy-browser/
conda create -n loopy -f loopy-browser/environment.yml
pip install .
```

An example script is available at [`scripts/run_sample.ipynb`](scripts/run_sample.ipynb).

## Nomenclature

Being compatible with static hosting, there are multiple layers of data.

- `sample.json`: this contains the overall detail of the sample, such as its names and list of features.
- `{features}.json`: these are either headers for `ChunkedJSON` or headers and data for `PlainJSON`.
