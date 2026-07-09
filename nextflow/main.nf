#!/usr/bin/env nextflow

nextflow.enable.dsl = 2

include { PREPROCESS_SAMUI } from './modules/preprocess'
include { BUILD_SAMUI; ASSEMBLE_SITE } from './modules/site'

// Single entrypoint. --format selects the input mode:
//   named platform (xenium|visium|visium_hd|cosmx) or `auto`
//                          -> read from --folder
//   spatialdata            -> read from --zarr (.zarr.zip or .zarr directory)
//   files                  -> --image / --cells / --features / --matrix
workflow {
    log.info "Parameters:\n" + params.collect { k, v -> "  ${k} = ${v}" }.sort().join("\n")

    if (!params.format) {
        error "Missing required parameter --format (a platform, 'auto', 'spatialdata', or 'files')"
    }

    // Ensure the mounted uv cache dir exists and is owned by the host user.
    file(params.uv_cache).mkdirs()

    def staged
    if (params.format == 'spatialdata') {
        if (!params.zarr) error "--format spatialdata requires --zarr"
        staged = [file(params.zarr, checkIfExists: true)]
    } else if (params.format == 'files') {
        if (!params.cells || !params.matrix) error "--format files requires --cells and --matrix"
        staged = [params.image, params.cells, params.features, params.matrix]
            .findAll { p -> p }
            .collect { p -> file(p, checkIfExists: true) }
    } else {
        if (!params.folder) error "--format ${params.format} requires --folder"
        staged = [file(params.folder, checkIfExists: true)]
    }

    // Install the readers + `preprocess` CLI from this repo checkout (the loopy
    // package), so runtime uses the current source without a push. projectDir is
    // nextflow/; the package lives at the repo root beside it.
    def repoRoot = file("${projectDir}/..")
    def pkgSrc = [
        file("${repoRoot}/pyproject.toml", checkIfExists: true),
        file("${repoRoot}/README.md",      checkIfExists: true),
        file("${repoRoot}/loopy",          checkIfExists: true),
    ]

    PREPROCESS_SAMUI(channel.value(staged), channel.value(pkgSrc))

    // Build the Samui viewer from a release and co-host it with the data, so the
    // published output is a single-origin static site (no cross-origin fetches).
    BUILD_SAMUI(params.samui_version)
    ASSEMBLE_SITE(PREPROCESS_SAMUI.out.sample, BUILD_SAMUI.out.build)
    ASSEMBLE_SITE.out.site.collect().view { "Bundled Samui site published to: ${params.outdir} (serve it and open index.html)" }
}
