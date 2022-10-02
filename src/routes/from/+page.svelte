<script lang="ts">
  import MainPage from '../MainPage.svelte';
</script>

<!-- Split to give prior knowledge if url query is provided to reduce rerenders and flashing. -->
<MainPage loadExternal={true} />
