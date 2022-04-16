<script lang="ts">
  type Color = 'viridis' | 'yellow';
  export let color: Color = 'viridis';
  export let min: number;
  export let max: number;
  export let opacity = 1;
  let cl = 'top-6 right-6';
  export { cl as class };

  const mapping: { [color in Color]: string } = {
    viridis:
      '#440154, #482475, #414487, #355f8d, #2a788e, #21908d, #22a884, #42be71, #7ad151, #bddf26, #bddf26',
    yellow: '#000000, #fce652'
  };
</script>

<div class={`absolute z-10 h-36 w-4 rounded border border-slate-600 ${cl}`}>
  <div class="absolute -right-5 -top-2 text-sm text-slate-200">{max}</div>
  <div class="absolute -right-5 top-[42.5%] text-sm text-slate-200">{(min + max) / 2}</div>
  <div class="absolute -right-5 -bottom-2 text-sm text-slate-200">{min}</div>
  <div class="h-full w-full" style={`opacity: ${opacity};`}>
    <div
      class="h-full w-full rounded"
      style={`background-image: linear-gradient(0deg, ${mapping[color]});`}
    />
  </div>
</div>
