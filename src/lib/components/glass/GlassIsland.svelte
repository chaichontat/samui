<script lang="ts">
  import { cn } from '$src/lib/utils';
  import { createEventDispatcher, onDestroy, onMount, tick } from 'svelte';
  import { cubicOut } from 'svelte/easing';
  import { spring, tweened } from 'svelte/motion';

  export let expanded = false;
  export let baseWidth = 220;
  export let baseHeight = 38;
  export let expandWidthRatio = 2.2;
  export let expandHeightRatio = 1;
  export let reducedMotion: boolean | null = null;
  export let reduceTransparency: boolean | null = null;
  export let glassBlur = 24;
  export let glassTint = 'rgba(20, 24, 32, 0.62)';
  export let glassBorderTint = 'rgba(255, 255, 255, 0.9)';
  export let glassGlow = 0.34;
  export let highlight = true;
  export let interactiveTilt = false;
  export let settleDuration = 480;
  export let stagger = 110;
  let cl = '';
  export { cl as class };

  type AnimationPhase = { phase: 'start' | 'settle'; expanded: boolean };
  type RequestDetail = { from: boolean; expanded: boolean };
  type HeightUpdateOptions = { skipSync?: boolean; hard?: boolean };

  const dispatch = createEventDispatcher<{
    pointerIntent: { type: 'enter' | 'leave' };
    transparencyFallback: { enabled: boolean };
    reduceMotionFallback: { enabled: boolean };
    stateChange: { expanded: boolean };
    animationPhase: AnimationPhase;
    requestState: RequestDetail;
  }>();

  const clampPositive = (value: number, fallback: number) =>
    Number.isFinite(value) && value > 0 ? value : fallback;
  $: baseWidth = clampPositive(baseWidth, 120);
  $: baseHeight = clampPositive(baseHeight, 28);
  $: expandWidthRatio = clampPositive(expandWidthRatio, 1);
  $: expandHeightRatio = clampPositive(expandHeightRatio, 1);
  $: glassBlur = Math.max(0, glassBlur);
  $: glassGlow = Math.min(Math.max(glassGlow, 0), 1);
  $: settleDuration = Math.max(120, settleDuration);
  $: stagger = Math.max(0, stagger);

  const widthSpring = spring(baseWidth, { stiffness: 0.16, damping: 0.5 });
  const heightSpring = spring(baseHeight, { stiffness: 0.14, damping: 0.48 });

  const widthTween = tweened(baseWidth, { duration: 220, easing: cubicOut });
  const heightTween = tweened(baseHeight, { duration: 220, easing: cubicOut });

  const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

  let prefersReducedMotion = reducedMotion ?? false;
  let reduceMotionMedia: MediaQueryList | null = null;
  let reduceMotionListener: ((event: MediaQueryListEvent) => void) | null = null;

  let reduceTransparencyMedia: MediaQueryList | null = null;
  let reduceTransparencyListener: ((event: MediaQueryListEvent) => void) | null = null;
  let transparencyReduced = reduceTransparency ?? false;

  let shell: HTMLDivElement | null = null;
  let main: HTMLDivElement | null = null;
  let tiltX = 0;
  let tiltY = 0;
  let glowX = 0;
  let glowY = 0;
  let mounted = false;
  let heightInitialized = false;
  let isOrchestrating = false;
  const heightTargets = new Map<boolean, number>();
  const HEIGHT_EPSILON = 0.5;

  const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

  function setTransparencyPreference(value: boolean) {
    if (transparencyReduced !== value) {
      transparencyReduced = value;
      dispatch('transparencyFallback', { enabled: transparencyReduced });
    }
  }

  function setMotionPreference(value: boolean) {
    if (prefersReducedMotion !== value) {
      prefersReducedMotion = value;
      dispatch('reduceMotionFallback', { enabled: prefersReducedMotion });
    }
  }

  onMount(() => {
    mounted = true;

    if (typeof window === 'undefined') return;

    if (reduceTransparency === null && 'matchMedia' in window) {
      reduceTransparencyMedia = window.matchMedia('(prefers-reduced-transparency: reduce)');
      setTransparencyPreference(reduceTransparencyMedia.matches);
      reduceTransparencyListener = (event) => setTransparencyPreference(event.matches);
      reduceTransparencyMedia.addEventListener('change', reduceTransparencyListener);
    } else if (reduceTransparency !== null) {
      setTransparencyPreference(reduceTransparency);
    }

    if (reducedMotion === null && 'matchMedia' in window) {
      reduceMotionMedia = window.matchMedia('(prefers-reduced-motion: reduce)');
      setMotionPreference(reduceMotionMedia.matches);
      reduceMotionListener = (event) => setMotionPreference(event.matches);
      reduceMotionMedia.addEventListener('change', reduceMotionListener);
    } else if (reducedMotion !== null) {
      setMotionPreference(reducedMotion);
    }

    scheduleHeightRefresh(expanded, { hard: true });
  });

  onDestroy(() => {
    if (reduceTransparencyMedia && reduceTransparencyListener) {
      reduceTransparencyMedia.removeEventListener('change', reduceTransparencyListener);
    }
    if (reduceMotionMedia && reduceMotionListener) {
      reduceMotionMedia.removeEventListener('change', reduceMotionListener);
    }
    mounted = false;
  });

  $: if (reduceTransparency !== null) {
    setTransparencyPreference(reduceTransparency);
  }

  $: if (reducedMotion !== null) {
    setMotionPreference(reducedMotion);
  }

  type Targets = { width: number; height: number };
  const computeTargets = (targetExpanded: boolean): Targets => {
    const fallbackHeight = targetExpanded ? baseHeight * expandHeightRatio : baseHeight;
    const measuredHeight = heightTargets.get(targetExpanded) ?? fallbackHeight;
    if (targetExpanded) {
      return { width: baseWidth * expandWidthRatio, height: measuredHeight };
    }
    return { width: baseWidth, height: measuredHeight };
  };

  const initialTargets = computeTargets(expanded);
  widthSpring.set(initialTargets.width, { hard: true });
  heightSpring.set(initialTargets.height, { hard: true });
  widthTween.set(initialTargets.width);
  heightTween.set(initialTargets.height);

  let animationTicket = 0;
  let previousExpanded = expanded;
  let baseSignature = `${baseWidth}:${baseHeight}:${expandWidthRatio}:${expandHeightRatio}`;

  $: {
    const nextSignature = `${baseWidth}:${baseHeight}:${expandWidthRatio}:${expandHeightRatio}`;
    if (nextSignature !== baseSignature && expanded === previousExpanded) {
      scheduleHeightRefresh(expanded, { hard: true });
      const nextTargets = computeTargets(expanded);
      if (prefersReducedMotion) {
        widthTween.set(nextTargets.width);
        heightTween.set(nextTargets.height);
      } else {
        console.log('forcing size update');
        widthSpring.set(nextTargets.width, { hard: true });
        heightSpring.set(nextTargets.height, { hard: true });
      }
      baseSignature = nextSignature;
    }
  }

  async function orchestrateTransition(next: boolean, prev: boolean) {
    const ticket = ++animationTicket;
    dispatch('animationPhase', { phase: 'start', expanded: next });

    isOrchestrating = true;
    if (mounted) {
      await refreshHeightForState(next, { skipSync: true });
      if (ticket !== animationTicket) {
        isOrchestrating = false;
        return;
      }
    }

    const targets = computeTargets(next);

    if (prefersReducedMotion) {
      widthTween.set(targets.width);
      heightTween.set(targets.height);
      dispatch('animationPhase', { phase: 'settle', expanded: next });
      isOrchestrating = false;
      return;
    }

    const widthStore = widthSpring;
    const heightStore = heightSpring;

    const sequence = async () => {
      if (next && !prev) {
        widthStore.set(targets.width);
        if (ticket !== animationTicket) return;
        await wait(stagger);
        if (ticket !== animationTicket) return;
        heightStore.set(targets.height);
      } else if (!next && prev) {
        heightStore.set(targets.height);
        if (ticket !== animationTicket) return;
        await wait(stagger - 20);
        if (ticket !== animationTicket) return;
        widthStore.set(targets.width);
      } else {
        widthStore.set(targets.width);
        heightStore.set(targets.height);
      }
    };

    await sequence();
    if (ticket !== animationTicket) {
      isOrchestrating = false;
      return;
    }

    const bounce = async () => {
      let widthOvershoot = 0;
      let heightOvershoot = 0;

      if (next) {
        widthOvershoot = 0.02;
        heightOvershoot = 0.04;
      } else if (!next && prev) {
        widthOvershoot = -0.02;
        heightOvershoot = -0.03;
      }

      if (widthOvershoot !== 0) {
        widthStore.set(targets.width * (1 + widthOvershoot));
        if (ticket !== animationTicket) return;
        await wait(95);
        if (ticket !== animationTicket) return;
        widthStore.set(targets.width);
      }

      if (heightOvershoot !== 0) {
        heightStore.set(targets.height * (1 + heightOvershoot));
        if (ticket !== animationTicket) return;
        await wait(95);
        if (ticket !== animationTicket) return;
        heightStore.set(targets.height);
      }
    };

    await bounce();
    dispatch('animationPhase', { phase: 'settle', expanded: next });
    await wait(settleDuration);
    isOrchestrating = false;
  }

  $: if (expanded !== previousExpanded) {
    orchestrateTransition(expanded, previousExpanded);
    dispatch('stateChange', { expanded });
    previousExpanded = expanded;
  }

  $: {
    const targets = computeTargets(expanded);
    if (prefersReducedMotion) {
      widthTween.set(targets.width);
      heightTween.set(targets.height);
    }
  }

  $: widthValue = prefersReducedMotion ? $widthTween : $widthSpring;
  $: heightValue = prefersReducedMotion ? $heightTween : $heightSpring;
  $: radiusValue = 12;
  // heightInitialized ? `height:${heightValue}px;` :
  $: mainStyle = `width:${widthValue}px;${'height:auto;'}border-radius:${radiusValue}px;`;

  function handleSlotChange() {
    scheduleHeightRefresh(expanded);
  }

  function measureNaturalHeight(state: boolean): number | null {
    if (!main) return null;
    const targetWidth = state ? baseWidth * expandWidthRatio : baseWidth;
    const previousHeight = main.style.height;
    const previousWidth = main.style.width;
    main.style.width = `${targetWidth}px`;
    main.style.height = 'auto';
    const measured = main.getBoundingClientRect().height;
    main.style.width = previousWidth;
    main.style.height = previousHeight;
    if (!Number.isFinite(measured) || measured <= 0) return null;
    return measured;
  }

  function syncHeightForActiveState(hard = false) {
    const target = heightTargets.get(expanded);
    if (target === undefined) return;
    const normalized = Math.max(target, 1);
    heightSpring.set(normalized, hard ? { hard: true } : undefined);
    heightTween.set(normalized);
    heightInitialized = true;
  }

  function storeMeasuredHeight(state: boolean, height: number, options: HeightUpdateOptions = {}) {
    const normalized = Math.max(height, 1);
    const previous = heightTargets.get(state);
    if (previous !== undefined && Math.abs(previous - normalized) < HEIGHT_EPSILON) {
      return;
    }
    heightTargets.set(state, normalized);

    const skipSync = (options.skipSync ?? false) || isOrchestrating;
    if (state === expanded && (!skipSync || !heightInitialized)) {
      syncHeightForActiveState(options.hard ?? !heightInitialized);
    }
  }

  async function refreshHeightForState(state: boolean, options: HeightUpdateOptions = {}) {
    if (!mounted) return;
    await tick();
    const measured = measureNaturalHeight(state);
    if (measured === null) return;
    storeMeasuredHeight(state, measured, options);
  }

  function scheduleHeightRefresh(state: boolean, options: HeightUpdateOptions = {}) {
    if (!mounted) return;
    void refreshHeightForState(state, options);
  }

  function resetTilt() {
    tiltX = 0;
    tiltY = 0;
    glowX = 0;
    glowY = 0;
  }

  function handlePointerEnter() {
    dispatch('pointerIntent', { type: 'enter' });
  }

  function handlePointerLeave() {
    dispatch('pointerIntent', { type: 'leave' });
    resetTilt();
  }

  function handlePointerMove(event: PointerEvent) {
    if (!interactiveTilt || transparencyReduced || prefersReducedMotion || !shell) return;
    const rect = shell.getBoundingClientRect();
    const nx = clamp((event.clientX - rect.left) / rect.width, 0, 1);
    const ny = clamp((event.clientY - rect.top) / rect.height, 0, 1);
    const tiltRange = 5.5;
    tiltX = (nx - 0.5) * tiltRange;
    tiltY = -(ny - 0.5) * tiltRange;
    const glowRange = 8;
    glowX = (nx - 0.5) * glowRange;
    glowY = (ny - 0.5) * glowRange;
  }

  function handleClick() {
    const next = !expanded;
    dispatch('requestState', { from: expanded, expanded: next });
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      handleClick();
    }
    if (event.key === 'Escape') {
      dispatch('requestState', { from: expanded, expanded: false });
    }
  }

  $: cssVars = `--lgis-blur:${glassBlur}px;--lgis-tint:${glassTint};--lgis-border:${glassBorderTint};--lgis-border-width:${1.6}px;--lgis-radius:${radiusValue}px;--lgis-glow:${glassGlow};--lgis-tilt-x:${tiltX.toFixed(3)}deg;--lgis-tilt-y:${tiltY.toFixed(3)}deg;--lgis-glow-x:${glowX.toFixed(2)}px;--lgis-glow-y:${glowY.toFixed(2)}px;`;
</script>

<div
  bind:this={shell}
  class="lgis-shell"
  class:reduce-transparency={transparencyReduced}
  class:no-highlight={!highlight || transparencyReduced}
  class:no-tilt={!interactiveTilt || transparencyReduced || prefersReducedMotion}
  class:reduced-motion={prefersReducedMotion}
  data-expanded={expanded}
  style={cssVars}
  on:pointerenter={handlePointerEnter}
  on:pointerleave={handlePointerLeave}
  on:pointermove={handlePointerMove}
  on:click={handleClick}
  on:keydown={handleKeydown}
  role="button"
  tabindex="0"
  aria-pressed={expanded}
  aria-expanded={expanded}
  data-testid="liquid-glass-island"
  {...$$restProps}
>
  <div bind:this={main} class={cn('lgis-main', cl)} style={mainStyle}>
    <div class="lgis-motion">
      <span class="lgis-highlight" aria-hidden="true"></span>
      <slot />
    </div>
  </div>
</div>

<style lang="postcss">
  .lgis-shell {
    --lgis-shadow: 0 24px 46px rgba(10, 14, 25, calc(0.55 * var(--lgis-glow)));
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 0;
    isolation: isolate;
    color: #f4f6f8;
    transition: transform 180ms cubic-bezier(0.25, 0, 0.4, 1);
    outline: none;
    perspective: 1000px;
    transform-origin: center;
  }

  .lgis-shell:focus-visible {
    box-shadow: 0 0 0 3px rgba(130, 170, 255, 0.35);
  }

  .lgis-main {
    position: relative;
    display: grid;
    place-items: stretch;
    min-width: 0;
    background: var(--lgis-tint);
    backdrop-filter: blur(var(--lgis-blur)) saturate(1.35);
    -webkit-backdrop-filter: blur(var(--lgis-blur)) saturate(1.35);
    border-radius: inherit;
    box-shadow:
      var(--lgis-shadow),
      0 0 28px rgba(114, 174, 255, calc(0.4 * var(--lgis-glow)));
    overflow: hidden;
    transition: box-shadow 150ms cubic-bezier(0.25, 0, 0.4, 1);
  }

  .lgis-shell:hover .lgis-main,
  .lgis-shell:focus-visible .lgis-main {
    box-shadow:
      0 20px 42px rgba(10, 14, 25, calc(0.5 * var(--lgis-glow))),
      0 0 36px rgba(140, 190, 255, calc(0.55 * var(--lgis-glow)));
  }

  .lgis-motion {
    position: relative;
    display: grid;
    place-items: stretch;
    width: 100%;
    height: 100%;
    transform-style: preserve-3d;
    transform: perspective(800px) rotateX(var(--lgis-tilt-y, 0deg))
      rotateY(var(--lgis-tilt-x, 0deg));
    will-change: transform;
  }

  .lgis-main::before {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    padding: var(--lgis-border-width, 1.6px);
    background:
      linear-gradient(
        130deg,
        rgba(255, 255, 255, 0.5),
        rgba(255, 255, 255, 0.18) 45%,
        rgba(0, 0, 0, 0.42)
      ),
      linear-gradient(210deg, rgba(196, 226, 255, 0.3), rgba(74, 93, 114, 0.2));
    background-blend-mode: screen;
    pointer-events: none;
    opacity: 0.95;
    -webkit-mask:
      linear-gradient(#fff 0 0) content-box,
      linear-gradient(#fff 0 0);
    -webkit-mask-composite: xor;
    mask-composite: exclude;
  }

  .lgis-main::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    pointer-events: none;
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.28),
      inset 0 -22px 42px rgba(15, 18, 26, 0.7),
      inset 0 28px 46px rgba(255, 255, 255, 0.1);
    mix-blend-mode: screen;
    opacity: 0.9;
  }

  .lgis-highlight {
    position: absolute;
    top: 10%;
    left: 14%;
    width: 46%;
    height: 46%;
    pointer-events: none;
    background: radial-gradient(
      150% 120% at 22% 32%,
      rgba(255, 255, 255, 0.32) 0%,
      rgba(255, 255, 255, 0.12) 38%,
      transparent 72%
    );
    filter: blur(18px);
    transform: translate3d(var(--lgis-glow-x, 0px), var(--lgis-glow-y, 0px), 0);
    transition:
      transform 160ms ease-out,
      opacity 200ms ease-out;
    opacity: 0.38;
    mix-blend-mode: screen;
  }

  .lgis-shell.no-highlight .lgis-highlight {
    opacity: 0;
    animation: none;
  }

  .lgis-shell.no-tilt .lgis-motion,
  .lgis-shell.no-tilt:hover .lgis-motion,
  .lgis-shell.no-tilt:focus-visible .lgis-motion {
    transform: none;
  }

  .lgis-shell[data-expanded='true'] .lgis-main {
    animation: lgis-expand-bounce 440ms cubic-bezier(0.5, 1, 0.75, 1.25) forwards;
  }

  .lgis-shell[data-expanded='false'] .lgis-main {
    animation: lgis-collapse-bounce 440ms cubic-bezier(0.5, 1, 0.75, 1.25) forwards;
  }

  .lgis-shell.reduced-motion,
  .lgis-shell.reduced-motion .lgis-main {
    animation: none !important;
  }

  .reduce-transparency .lgis-main {
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
    background: color-mix(in srgb, var(--lgis-tint) 70%, #06070b 30%);
    box-shadow: 0 18px 30px rgba(8, 10, 16, calc(0.5 * var(--lgis-glow)));
  }

  .reduce-transparency .lgis-main::before {
    background: linear-gradient(
      140deg,
      rgba(255, 255, 255, 0.7),
      rgba(255, 255, 255, 0.3) 50%,
      rgba(0, 0, 0, 0.45)
    );
  }

  .reduce-transparency .lgis-main::after,
  .reduce-transparency .lgis-highlight {
    opacity: 0;
    animation: none;
  }

  @media (prefers-reduced-motion: reduce) {
    .lgis-shell,
    .lgis-main {
      transition: none !important;
      animation: none !important;
    }
  }

  @keyframes lgis-expand-bounce {
    0% {
      transform: scaleX(1) scaleY(1);
    }
    52% {
      transform: scaleX(1.01) scaleY(1);
    }
    74% {
      transform: scaleX(1) scaleY(1.01);
    }
    100% {
      transform: scaleX(1) scaleY(1);
    }
  }

  @keyframes lgis-collapse-bounce {
    0% {
      transform: scaleX(1) scaleY(1);
    }
    60% {
      transform: scaleX(0.99) scaleY(1.01);
    }
    82% {
      transform: scaleX(1.02) scaleY(1);
    }
    100% {
      transform: scaleX(1) scaleY(1);
    }
  }
</style>
