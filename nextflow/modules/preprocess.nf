include { uvInstall } from './common'

// Per-format extra pip dependencies on top of the base loopy set (which already
// brings numpy/pandas/scipy/anndata/h5py/tifffile/rasterio). Only what a format's
// reader actually needs is installed. `auto` installs the union of the platforms
// detect_format can return, since the platform is unknown until the folder is
// sniffed at runtime. Defined as a function because a bare top-level assignment is
// not a valid Nextflow script declaration.
def extraDeps(String fmt) {
    def deps = [
        xenium:      'pyarrow imagecodecs',
        visium:      'imagecodecs',
        visium_hd:   'pyarrow shapely imagecodecs',
        cosmx:       '',
        spatialdata: 'zarr spatialdata',
        files:       'pyarrow imagecodecs',
        auto:        'pyarrow imagecodecs shapely',
    ]
    return deps.getOrDefault(fmt, '')
}

process PREPROCESS_SAMUI {
    tag "${params.sample_name}"
    // ASSEMBLE_SITE publishes the combined site; this process only stages the sample.

    input:
    path staged
    path pkgsrc   // package source (pyproject.toml, README.md, loopy/) from this repo checkout

    output:
    path "${params.sample_name}", emit: sample

    script:
    def fmt = params.format
    def src
    if (fmt == 'spatialdata') {
        src = "--zarr ${file(params.zarr).name}"
    } else if (fmt == 'files') {
        src = [
            params.image    ? "--image ${file(params.image).name}"       : '',
            params.cells    ? "--cells ${file(params.cells).name}"       : '',
            params.features ? "--features ${file(params.features).name}" : '',
            params.matrix   ? "--matrix ${file(params.matrix).name}"     : '',
        ].findAll { arg -> arg }.join(' ')
    } else {
        src = "--folder ${file(params.folder).name}"
    }

    def calib = [
        params.pixel_size      != null ? "--pixel-size ${params.pixel_size}"             : '',
        params.mpp             != null ? "--mpp ${params.mpp}"                           : '',
        params.spot_size       != null ? "--spot-size ${params.spot_size}"              : '',
        params.coords_name             ? "--coords-name '${params.coords_name}'"         : '',
        params.default_feature         ? "--default-feature '${params.default_feature}'" : '',
    ].findAll { arg -> arg }.join(' ')
    def imgopt = [
        params.convert_8bit ? '--convert-8bit' : '',
        params.no_image     ? '--no-image'     : '',
    ].findAll { arg -> arg }.join(' ')
    def extra = extraDeps(fmt)
    """
    # Assemble the staged package files into a single tree for `uv pip install`.
    mkdir -p samui_src && cp -RL pyproject.toml README.md loopy samui_src/
    ${uvInstall(extra)}
    preprocess \\
        --format ${fmt} \\
        --outdir . \\
        --sample-name '${params.sample_name}' \\
        ${src} ${calib} ${imgopt}
    """
}
