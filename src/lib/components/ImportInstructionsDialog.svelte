<script lang="ts">
  import CodeHighlight from '$src/lib/components/CodeHighlight.svelte';
  import { Dialog } from 'bits-ui';
  import { createEventDispatcher } from 'svelte';

  export let open = false;

  const dispatch = createEventDispatcher<{ close: void }>();

  const cliSnippet = `conda activate loopy
loopy image path/to/image.tif --scale 0.5e-6 --channels DAPI,GFAP

# Optional: integrate spaceranger output
loopy spaceranger /path/to/spaceranger --out ./loopy --name sample_name`;

  const apiSnippet = `from pathlib import Path
from loopy.sample import Sample
import pandas as pd

coords = pd.read_csv("coords.csv", index_col=0)
(
    Sample(name="MySample", path=Path("out/MySample"))
    .add_image("path/to/image.tif", channels=["DAPI", "GFAP"], scale=0.5e-6)
    .add_coords(coords, name="cells", mPerPx=0.5e-6, size=5e-6)
    .write()
)`;

  let wasOpen = open;

  $: if (wasOpen && !open) {
    dispatch('close');
  }

  $: wasOpen = open;
</script>

<Dialog.Root bind:open>
  <Dialog.Portal>
    <Dialog.Overlay
      class="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
      data-testid="import-instructions-backdrop"
      on:click={() => (open = false)}
    />
    <Dialog.Content
      class="fixed left-1/2 top-1/2 z-50 w-[min(92vw,48rem)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/10 bg-neutral-900/95 p-6 text-neutral-100 shadow-2xl backdrop-blur"
      role="dialog"
      aria-label="Samui preprocessing instructions"
    >
      <header class="flex items-start justify-between gap-4">
        <div>
          <Dialog.Title class="text-2xl font-semibold text-neutral-50">
            Process Data for Samui
          </Dialog.Title>
          <Dialog.Description class="mt-1 text-sm text-neutral-300">
            Follow these steps to prepare a sample folder that imports cleanly into the browser.
          </Dialog.Description>
        </div>
        <Dialog.Close
          class="rounded-full border border-neutral-700 px-3 py-1 text-sm font-medium text-neutral-200 transition hover:bg-neutral-800"
          data-testid="close-import-instructions"
        >
          Close
        </Dialog.Close>
      </header>

      <div
        class="mt-4 flex max-h-[min(70vh,560px)] flex-col space-y-6 overflow-y-auto pr-2 text-sm leading-6 pb-4"
      >
        <section class="space-y-2">
          <h3 class="text-base font-semibold text-neutral-100">Before you start</h3>
          <ul class="list-disc space-y-1 pl-6 text-neutral-200">
            <li>
              Create the conda environment:
              <code
                class="mt-0.5 block w-fit rounded-md bg-neutral-950/70 px-3 py-1 font-mono text-sm text-neutral-100"
              >
                conda env create -n loopy -f environment.yml
              </code>
              <p class="mt-0.5">(Loopy was Samui's original name).</p>
            </li>
          </ul>
        </section>

        <section class="space-y-3">
          <h3 class="text-base font-semibold text-neutral-100">Build a Samui sample</h3>
          <ol class="list-decimal space-y-3 pl-6 text-neutral-200">
            <li>
              <span class="font-medium text-neutral-100">Generate assets with Loopy.</span>
              <p class="mt-0.5 text-neutral-300">
                Choose either the command line or Python API workflow; both populate
                <code class="font-mono text-neutral-100">sample.json</code>
                , which is the data manifest along with actual data files. In this example, we process
                a large TIFF image for Samui and overlay it with a point cloud feature.
              </p>

              <div class="mt-3 grid gap-4 md:grid-cols-1 -ml-4">
                <!-- <div class="rounded-xl border border-neutral-800 bg-neutral-950/70 p-4">
                  <p class="mb-1 text-xs uppercase tracking-wide text-neutral-400">CLI workflow</p>
                  <CodeHighlight
                    code={cliSnippet}
                    language="bash"
                    wrap
                    className="text-xs"
                    showCopy
                    ariaLabel="Loopy CLI example"
                  />
                </div> -->
                <div class="rounded-xl border border-neutral-800 bg-neutral-950/70 p-4">
                  <p class="mb-1 text-xs uppercase tracking-wide text-neutral-400">
                    Python API workflow
                  </p>
                  <CodeHighlight
                    code={apiSnippet}
                    language="python"
                    wrap
                    className="text-xs"
                    showCopy
                    ariaLabel="Loopy Python API example"
                  />
                </div>
              </div>
            </li>
            <li>
              <span class="font-medium text-neutral-100">Verify the output folder.</span>
              <p class="mt-0.5 text-neutral-300">
                Confirm the folder contains <code class="font-mono text-neutral-100">
                  sample.json
                </code>
                , tiled imagery, coordinates (e.g.
                <code class="font-mono text-neutral-100">*_coords.csv</code>
                ), feature matrices, and optional metadata files referenced in the manifest.
              </p>
            </li>
            <li>
              <span class="font-medium text-neutral-100">Keep paths stable.</span>
              <p class="mt-0.5 text-neutral-300">
                Samui resolves assets relative to <code class="font-mono text-neutral-100">
                  sample.json
                </code>
                ; rename files only if you update the manifest accordingly.
              </p>
            </li>
          </ol>
        </section>

        <section class="space-y-2">
          <h3 class="text-base font-semibold text-neutral-100">Import in Samui</h3>
          <ol class="list-decimal space-y-2 pl-6 text-neutral-200">
            <li>
              Open Samui&rsquo;s home page and select <strong>Import data</strong>
              .
            </li>
            <li>Choose your prepared sample folder when prompted.</li>
          </ol>
        </section>

        <section class="space-y-2">
          <h3 class="text-base font-semibold text-neutral-100">Need to add overlays later?</h3>
          <p class="text-neutral-300">
            Drag ROI/annotation JSON files or feature CSVs onto the viewer&mdash;they load without
            re-importing the whole sample.
          </p>
        </section>

        <section class="space-y-2">
          <h3 class="text-base font-semibold text-neutral-100">Troubleshooting</h3>
          <ul class="list-disc space-y-1 pl-6 text-neutral-200">
            <li>
              <strong>“Folder must contain sample.json”</strong>
              : ensure the manifest sits at the top level you select.
            </li>
            <li>
              <strong>“Unsupported file type”</strong>
              : single-file imports accept ROI/annotation JSON and feature CSVs only.
            </li>
            <li>
              <strong>Slow conversion/large file size</strong>
              : re-run
              <code class="font-mono text-neutral-100">loopy image</code>
              with
              <code class="font-mono text-neutral-100">--convert8bit</code>
              or downsample before import.
            </li>
          </ul>
        </section>

        <section class="space-y-2">
          <h3 class="text-base font-semibold text-neutral-100">More help</h3>
          <p class="text-neutral-300">
            Visit the
            <a
              href="https://github.com/chaichontat/samui"
              class="font-medium text-neutral-100 underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              Samui repository
            </a>
            for more detailed guidance on preparing your data.
          </p>
        </section>
      </div>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
