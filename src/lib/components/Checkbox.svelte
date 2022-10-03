<script lang="ts">
  export let checked: boolean;
</script>

<label class="cursor-pointer">
  <input class="translate-y-0.5" type="checkbox" bind:checked />
  <span class="ml-0.5"><slot /></span>
</label>
