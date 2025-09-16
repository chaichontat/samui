<script lang="ts">
  import { overlays, sEvent } from '$lib/store';
  import * as Plot from '@observablehq/plot';
  import { colorMaps } from '../ui/overlays/featureColormap';
  import { tooltip } from '../ui/utils';

  let div: HTMLDivElement;
  let divs: Record<string, Element> = {};

  function updateLegend() {
    console.log('updateLegend');

    while (div.firstChild) {
      div.removeChild(div.firstChild);
    }
    divs = {};

    for (const [ol, ov] of Object.entries($overlays)) {
      if (!ov.currFeature) return;

      // for (const uid of Object.keys(divs)) {
      //   if (!Object.keys($overlays).includes(uid)) {
      //     div.removeChild(divs[uid]);
      //     delete divs[uid];
      //   }
      // }

      // if (divs[ol]) {
      //   div.removeChild(divs[ol]);
      //   delete divs[ol];
      // }

      divs[ol] = document.createElement('div');
      div.appendChild(divs[ol]);

      const ks = $overlays[ol].currLegend;
      let elem: Element;
      if (ks) {
        elem = Plot.legend({
          color: {
            domain: ks.map((x) => `${x}`.toString()) // Convert null to string
          },
          legend: 'swatches',
          className: 'alphabet',
          style: {
            fontSize: '13px'
          }
        });
      } else {
        elem = Plot.legend({
          color: {
            interpolate: (i) => colorMaps[ov.currColorMap](0.05 + i * 0.95),
            domain: [ov.currStyleVariables.min, ov.currStyleVariables.max]
          },
          width: 250,
          ticks: 5,
          label: ov.currUnit,
          // height: 30,
          // marginTop: -5,
          className: 'colorbar',
          style: {
            'background-color': 'transparent',
            fontSize: '10px'
          }
        });
      }

      const name = document.createElement('div');
      name.classList.add('legend-name');
      if (!ks) {
        name.style.marginBottom = '-14px';
      }
      name.innerText = ov.currFeature?.feature ?? '';
      divs[ol].prepend(name);
      divs[ol].appendChild(elem);
      div.appendChild(divs[ol]);
    }
  }

  $: if (div && ($sEvent?.type === 'featureUpdated' || $sEvent?.type === 'overlayAdjusted')) {
    updateLegend();
  }
</script>

<div
  bind:this={div}
  data-testid="overlay-legend"
  use:tooltip={{
    content:
      "To change scale, click on the colored circle icon next to a layer's name (straight up above this colorbar)."
  }}
/>

<style lang="postcss">
  div :global(.alphabet) {
    @apply mt-2 flex flex-wrap items-end gap-0.5;
  }

  div :global(.alphabet-swatch) {
    @apply mx-0
  }

  div :global(.alphabet-swatches) {
    @apply flex flex-col flex-wrap items-end gap-0.5;
  }

  div :global(.legend-name) {
    @apply text-end text-sm font-medium text-neutral-50;
  }
</style>
