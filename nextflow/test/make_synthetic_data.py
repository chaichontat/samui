#!/usr/bin/env python3
"""Generate a tiny synthetic dataset for the `files` input mode: a single-channel
TIFF image, a cells table (id,x,y + a categorical label) and an expression matrix
(genes x cells). Coordinates land on bright blobs in the image so a correct overlay
is visually obvious in the Samui browser.

  nextflow run main.nf --format files \
      --cells test/data/cells.csv --matrix test/data/matrix.csv --image test/data/image.tif \
      --sample_name synthetic --outdir results --mpp 0.5e-6 --default_feature gene_0
"""
import argparse
from pathlib import Path

import numpy as np
import pandas as pd
import tifffile

N_CELLS = 200
N_GENES = 50
IMG_SIZE = 512  # pixels
BLOB_SIGMA = 6.0
SEED = 0


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--outdir", type=Path, default=Path("test/data"))
    args = p.parse_args()
    args.outdir.mkdir(parents=True, exist_ok=True)

    rng = np.random.default_rng(SEED)
    ids = [f"cell_{i}" for i in range(N_CELLS)]
    gene_ids = [f"gene_{g}" for g in range(N_GENES)]
    coords_px = rng.integers(20, IMG_SIZE - 20, size=(N_CELLS, 2))

    img = rng.normal(300, 30, size=(IMG_SIZE, IMG_SIZE)).clip(0)
    yy, xx = np.mgrid[0:IMG_SIZE, 0:IMG_SIZE]
    for x, y in coords_px:
        img += 4000 * np.exp(-(((xx - x) ** 2 + (yy - y) ** 2) / (2 * BLOB_SIGMA**2)))
    tifffile.imwrite(args.outdir / "image.tif", img.astype(np.uint16))

    pd.DataFrame(
        {
            "id": ids,
            "x": coords_px[:, 0],
            "y": coords_px[:, 1],
            "celltype": rng.choice(["A", "B", "C"], N_CELLS),
        }
    ).to_csv(args.outdir / "cells.csv", index=False)

    # Genes (rows) x cells (cols) — the common gene-matrix orientation; the reader
    # auto-orients against the cell ids. A couple of genes are made spatially
    # structured so the overlay shows a gradient.
    counts = rng.poisson(lam=3.0, size=(N_GENES, N_CELLS)).astype(float)
    counts[0] += (coords_px[:, 0] / IMG_SIZE) * 30.0  # gene_0: left-to-right gradient
    counts[1] += (coords_px[:, 1] / IMG_SIZE) * 30.0  # gene_1: top-to-bottom
    pd.DataFrame(counts, index=gene_ids, columns=ids).to_csv(args.outdir / "matrix.csv")

    print(f"Wrote image.tif ({IMG_SIZE}x{IMG_SIZE}), cells.csv ({N_CELLS} cells), "
          f"matrix.csv ({N_GENES} genes x {N_CELLS} cells) to {args.outdir}")


if __name__ == "__main__":
    main()
