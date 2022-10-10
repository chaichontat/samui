<script lang="ts">
  import preload from '$src/lib/data/preload';
  import { onMount } from 'svelte';
  import MainPage from '../MainPage.svelte';

  onMount(preload);
</script>

<MainPage loadExternal={true} />
