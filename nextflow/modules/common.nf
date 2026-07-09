// Runtime setup shared by all Samui preprocessing processes.
//
// Dependencies are installed at runtime with uv into a venv in the task work dir,
// against a prebuilt uv image — so there is no Dockerfile to maintain. The loopy
// package (which now contains the `spatial_io` readers and the `preprocess` CLI) is
// installed from the current checkout of this repo, staged into the task as
// `samui_src`, without its deps (--no-deps) to skip the unused PyQt5 GUI dependency;
// its runtime deps are the explicit `deps` list below.
//
// extraDeps lets a data-type-specific process add packages its reader needs
// (e.g. the Xenium reader needs pyarrow for cells.parquet and imagecodecs so
// tifffile can decode the JPEG-2000 morphology image).

def uvInstall(String extraDeps = '', String srcDir = 'samui_src') {
    def deps = 'numpy pandas "pydantic>=1.10,<2" rasterio tifffile scipy anndata rich typing-extensions requests'
    """
    export HOME="\$PWD"
    uv venv .venv
    uv pip install --python .venv --quiet ${deps} ${extraDeps}
    uv pip install --python .venv --quiet --no-deps ./${srcDir}
    . .venv/bin/activate
    """.stripIndent()
}
