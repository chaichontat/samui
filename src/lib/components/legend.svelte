<script lang="ts">
  export let colormap: Record<string | number, `#${string}`>;
  $: filtered = Object.entries(colormap)
    .map(([name, color]) => ({ name, color }))
    .slice(0, 10);
</script>

<div class="flex w-full justify-evenly gap-x-2 rounded">
  {#each filtered as { name, color }}
    <span class="flex items-center gap-x-2">
      <div class="h-3 w-3" style={`background-color: ${color};`} />
      <div class="text-xs">{name}</div>
    </span>
  {/each}
</div>
