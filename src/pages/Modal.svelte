<script>
  import { fade } from 'svelte/transition';

  function overlay_click(e) {
    if ('close' in e.target.dataset) show = false;
  }

  export let show = false;
</script>

{#if show}
  <div>
    <div
      class="modal-overlay"
      data-close
      on:click={overlay_click}
      transition:fade={{ duration: 150 }}
    >
      <div class="modal-container">
        <main><p>About me...</p></main>
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 10;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }
  .modal-container {
    position: relative;
    background-color: #ffffff;
    width: 90vw;
    margin: 1rem auto 0.2rem;
    box-shadow: 0 3px 10px #555;
  }
  main {
    padding: 0.5rem;
  }
</style>
