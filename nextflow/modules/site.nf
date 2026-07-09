// Optional: bundle the Samui viewer with the data so the published output is a
// self-contained static site served from one origin (no cross-origin/CORS/whitelist).

// Download a Samui release and build its static site. The build runs as the host
// uid (Nextflow's docker -u), so pnpm is installed into a writable per-task prefix
// rather than globally, and HOME/store point inside the work dir.
process BUILD_SAMUI {
    tag "${version}"
    container params.node_image

    input:
    val version

    output:
    path "samui_build", emit: build

    script:
    """
    export HOME="\$PWD"
    export PATH="\$PWD/.npm-global/bin:\$PATH"
    npm config set prefix "\$PWD/.npm-global"
    npm install -g pnpm@10 >/dev/null 2>&1

    curl -fsSL -o samui.tar.gz "https://github.com/chaichontat/samui/archive/${version}.tar.gz"
    mkdir -p src && tar xzf samui.tar.gz -C src --strip-components=1
    cd src
    pnpm install --no-frozen-lockfile --store-dir "\$PWD/.pnpm-store"
    # pnpm 10 gates dependency build scripts; the native ones must build for vite.
    pnpm rebuild esbuild svelte-preprocess unrs-resolver
    pnpm run build
    cd ..
    mv src/build samui_build
    """
}

// Combine the built viewer (at the root) with the data folder into one directory,
// published so <outdir>/ is the servable site root. The viewer's own index.html loads
// external data from the ?url=&s= query, so we inject a small bootstrap that points it
// at the co-hosted sample in place (history.replaceState, not a redirect) — the data
// stays on one URL, so a browser refresh reloads the same view.
process ASSEMBLE_SITE {
    tag "${params.sample_name}"
    container params.uv_image
    // Publish the site CONTENTS at the outdir root (strip the staging `site/` prefix)
    // so the viewer's absolute /_app paths resolve against the host root.
    publishDir "${params.outdir}", mode: 'copy', saveAs: { fname -> fname.replaceFirst(/^site\//, '') }

    input:
    path sample
    path build

    output:
    path "site/**", emit: site

    script:
    """
    mkdir site
    cp -R ${build}/. site/
    rm -f site/visiumif.html          # drop Samui's bundled demo route
    cp -R ${sample} site/
    SAMPLE='${params.sample_name}' python3 - site/index.html <<'PY'
import json, os, sys
# Inject before the viewer hydrates: if no ?url= is set, point it at the sibling
# sample on this same host/dir, then let Samui's normal init read the query.
boot = (
    "<script>(function(){"
    "if(new URLSearchParams(location.search).get('url'))return;"
    "var p=location.pathname,d=p.slice(0,p.lastIndexOf('/'));"
    "history.replaceState(null,'',p+'?url='+location.host+d+'&s='+encodeURIComponent("
    + json.dumps(os.environ["SAMPLE"]) + "));"
    "})();</script>"
)
path = sys.argv[1]
with open(path) as f:
    html = f.read()
with open(path, "w") as f:
    f.write(html.replace("</head>", boot + "</head>", 1))
PY
    """
}
