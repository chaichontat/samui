<script lang="ts">
  import { annoFeat, annoHover, annoROI, sEvent, sMapp } from '$lib/store';
  import { classes } from '$lib/utils';
  import type { Draww } from '$src/lib/sidebar/annotation/annROI';
  import type { Mapp } from '$src/lib/ui/mapp';
  import { Plus, PlusCircle, XMark } from '@steeze-ui/heroicons';
  import { Icon } from '@steeze-ui/svelte-icon';
  import { schemeTableau10 } from 'd3';
  import AnnoButton from './annoButton.svelte';

  export let store: typeof annoROI | typeof annoFeat;
  export let draw: Draww;
  export let onLabelClick = () => {};
  export let labelClass = 'bg-cyan-700 shadow-cyan-800/20 hover:bg-cyan-600';
  export let buttonClass = 'bg-blue-700 shadow-blue-700/20 hover:bg-blue-600';

  let nPoints: Record<string, number> = { _total: 0 };
  let map: Mapp;
  $: map = $sMapp;

  $: if ($sEvent?.type === 'sampleUpdated') {
    draw.clear();
  }

  const alphanumeric = /^[a-zA-Z0-9_]*$/;
  function handleNewKey(name: string | null) {
    if (!name) return $store.currKey;

    if ($store.keys.findIndex((v) => v === name) === -1) {
      $store.keys.push(name);
      $store.keys = $store.keys;
      return $store.keys.length - 1;
    }
    alert('Key already exists.');
    return $store.currKey;
  }

  function getPrompt(prmt: string) {
    let name = prompt(prmt);
    if (name) {
      while (!alphanumeric.test(name)) {
        alert('Only alphanumeric characters and underscores are allowed.');
        name = prompt(prmt);
        if (!name) return null;
      }
      return name;
    }
    return null;
  }

  //   onMount(async () => {
  // await map.promise;
  // draw.draw.on('drawend', () => ($store.selecting = undefined));
  //   });

  // Enable/disable polygon draw
  $: if (map.map) {
    if (['Polygon', 'Circle', 'Point'].includes($store.selecting ?? '')) {
      map.map?.addInteraction(draw.draw);
      map.map.getViewport().style.cursor = 'crosshair';
    } else {
      map.map.removeInteraction(draw.draw);
      map.map.getViewport().style.cursor = 'default';
    }
  }

  $: if (['pointsAdded', 'sampleUpdated'].includes($sEvent?.type)) {
    nPoints = draw.getCounts();
  }
</script>

<section class="flex flex-col gap-y-1">
  <div class="flex items-center">
    <AnnoButton
      class={labelClass}
      onClick={() => {
        onLabelClick();
        $store.currKey = handleNewKey(getPrompt('Enter new label.'));
      }}
    >
      <Icon src={Plus} class="mr-0.5 h-3 w-3 translate-y-px stroke-current stroke-[2.5]" />
      Label
    </AnnoButton>

    <div class="ml-4 flex items-center gap-x-3 flex-wrap">
      {#each $store.keys as key, i}
        {#if key !== 'No one is going to name this.'}
          <label
            class="flex items-center gap-x-1 hover:underline cursor-pointer"
            on:mouseenter={() => ($annoHover = i)}
            on:mouseleave={() => ($annoHover = undefined)}
            on:click={() => ($store.currKey = i)}
            on:dblclick={() => {
              const oldName = key;
              const newName = getPrompt('Enter new label.');
              if (!newName) return;
              $store.keys[i] = newName;
              draw.relabel(oldName, newName);
            }}
          >
            <div class="h-3 w-3" style={`background-color: ${schemeTableau10[i % 10]}`} />
            <button
              class={classes($store.currKey === i ? 'font-bold' : 'font-normal text-neutral-300')}
            >
              {key}
            </button>
            <!-- Number -->
            {nPoints[key] ?? 0}
            <button
              on:click={() => {
                if (!confirm(`Delete label "${key}"?`)) return;
                // $store.keys.splice(i, 1);
                if ($store.currKey === i) $store.currKey = 0;
                draw.removeFeaturesByLabel(key);
                $store.keys[i] = 'No one is going to name this.';
                $store.keys = $store.keys;
              }}
            >
              <Icon src={XMark} class="svg-icon stroke-neutral-400 hover:stroke-white" />
            </button>
          </label>
        {/if}
      {/each}
      <!-- Unlabeled -->
      {#if nPoints.unlabeled_}
        <label
          class="flex items-center gap-x-1"
          on:mouseenter={() => ($annoHover = -1)}
          on:mouseleave={() => ($annoHover = undefined)}
        >
          <div class="h-3 w-3" style="background-color: #ccc" />
          <button class="font-normal text-neutral-300">Unlabeled</button>
          {nPoints.unlabeled_}
        </label>
      {/if}
    </div>
  </div>

  <!-- Select -->
  <div class="flex flex-wrap items-center gap-1">
    <AnnoButton
      class={buttonClass}
      ping={$store.selecting === 'Polygon'}
      disabled={($store.selecting !== undefined && $store.selecting !== 'Polygon') ||
        $store.keys.length === 0}
      onClick={() => {
        draw.changeDrawType('Polygon');
        $store.selecting = $store.selecting ? undefined : 'Polygon';
      }}
    >
      <Icon src={Plus} class="-ml-1 mr-0.5 h-3 w-3 translate-y-px stroke-current stroke-[2.5]" />
      Polygon
    </AnnoButton>

    <AnnoButton
      class={buttonClass}
      ping={$store.selecting === 'Circle'}
      disabled={($store.selecting !== undefined && $store.selecting !== 'Circle') ||
        $store.keys.length === 0}
      onClick={() => {
        draw.changeDrawType('Circle');
        $store.selecting = $store.selecting ? undefined : 'Circle';
      }}
    >
      <Icon
        src={PlusCircle}
        class="-ml-1 mr-0.5 h-3 w-3 translate-y-px stroke-current stroke-[2.5]"
      />
      Circle
    </AnnoButton>

    <slot />
  </div>
</section>
