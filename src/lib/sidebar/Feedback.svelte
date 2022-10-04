<script lang="ts">
  import { Popover, PopoverButton, PopoverPanel } from '@rgossiaux/svelte-headlessui';
  import { ChatBubbleLeftEllipsis } from '@steeze-ui/heroicons';
  import { Icon } from '@steeze-ui/svelte-icon';
  import { fade } from 'svelte/transition';
  import Spinner from '../components/spinner.svelte';

  let spinning = false;
  let response = '';
  let form: HTMLFormElement;

  function formSubmit(event: SubmitEvent) {
    event.preventDefault();
    spinning = true;
    const XHR = new XMLHttpRequest();
    const FD = new FormData(form);

    XHR.addEventListener('load', () => {
      response = '🎉 Submitted! Thank you for your feedback! 🎉';
      spinning = false;
    });

    XHR.addEventListener('error', () => {
      response = 'Oops! Something went wrong.';
      spinning = false;
    });

    XHR.open('POST', 'https://feedback.loopybrowser.com/submit');
    XHR.send(FD);
  }
</script>

<Popover let:open>
  <PopoverButton>
    <Icon
      src={ChatBubbleLeftEllipsis}
      class="svg-icon h-8 w-8 stroke-[1.5] hover:stroke-[2] translate-y-0.5"
    />
  </PopoverButton>

  {#if open}
    <div transition:fade={{ duration: 150 }}>
      <PopoverPanel static class="absolute z-10 w-[95%] max-w-sm px-4 pb-8 mt-3 right-4">
        <form
          bind:this={form}
          on:submit={formSubmit}
          class="prose overflow-hidden bg-neutral-100 rounded-lg shadow-xl shadow-black ring-1 ring-black ring-opacity-5 p-4 flex flex-col"
        >
          <h3>Feedback</h3>
          <div class="flex flex-col text-mb text-neutral-900 gap-y-3">
            <div>
              <span class="font-medium">Name / Institution</span>
              <input
                type="text"
                name="name"
                class="w-full border mt-1 border-neutral-600 rounded p-2"
              />
            </div>

            <div>
              <span class="font-medium">Message*</span>
              <textarea
                class="w-full p-2 placeholder-neutral-500 mt-1 bg-white rounded border border-neutral-600"
                name="message"
                placeholder="Input your feedback here."
                rows="6"
                required
              />
            </div>
            <div class="flex items-center gap-x-4">
              <button
                type="submit"
                class="mb-1 rounded-lg w-fit text-mb bg-sky-500 hover:bg-sky-600 shadow shadow-sky-600/20 active:bg-sky-700 text-white py-1 px-3 transtion-colors font-medium"
              >
                Submit
              </button>
              {#if spinning}
                <Spinner color="text-violet-700" />
              {/if}
              <div class="font-medium text-sm">
                {response}
              </div>
            </div>
          </div>
        </form>
      </PopoverPanel>
    </div>
  {/if}
</Popover>
