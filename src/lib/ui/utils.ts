import tippy from 'tippy.js';

export function tooltip(
  node: HTMLElement,
  initial: { content: string; enabled?: boolean }
) {
  let tip: ReturnType<typeof tippy> | undefined;
  let current = initial;

  const apply = ({ content, enabled = true }: { content: string; enabled?: boolean }) => {
    if (!enabled) {
      tip?.destroy();
      tip = undefined;
      node.removeAttribute('aria-label');
      node.removeAttribute('title');
      return;
    }

    node.setAttribute('aria-label', content);
    node.title = '';

    if (!tip) {
      tip = tippy(node, { content, delay: [100, 0] });
    } else {
      tip.setContent(content);
    }
  };

  apply(current);

  return {
    update(newParams: { content: string; enabled?: boolean }) {
      current = newParams;
      apply(current);
    },
    destroy() {
      tip?.destroy();
      tip = undefined;
    }
  };
}

export function clickOutside(node: HTMLElement) {
  const handleClick = (event: MouseEvent) => {
    if (node && !node.contains(event.target) && !event.defaultPrevented) {
      node.dispatchEvent(new CustomEvent('outclick'));
    }
  };

  document.addEventListener('click', handleClick, true);

  return {
    destroy() {
      document.removeEventListener('click', handleClick, true);
    }
  };
}

export function resizable(resizer: HTMLDivElement) {
  const leftSide = resizer.previousElementSibling!;
  const rightSide = resizer.nextElementSibling!;

  // The current position of mouse
  let x = 0;
  let y = 0;
  let leftWidth = 0;

  const mouseDownHandler = (e: MouseEvent) => {
    x = e.clientX;
    y = e.clientY;
    leftWidth = leftSide.getBoundingClientRect().width;

    document.addEventListener('mousemove', mouseMoveHandler);
    document.addEventListener('mouseup', mouseUpHandler);
  };

  const mouseMoveHandler = (e: MouseEvent) => {
    const dx = e.clientX - x;
    const dy = e.clientY - y;

    const newLeftWidth =
      ((leftWidth + dx) * 100) / resizer.parentNode!.getBoundingClientRect().width;
    leftSide.style.width = `${newLeftWidth}%`;

    resizer.style.cursor = 'col-resize';
    document.body.style.cursor = 'col-resize';

    leftSide.style.userSelect = 'none';
    leftSide.style.pointerEvents = 'none';

    rightSide.style.userSelect = 'none';
    rightSide.style.pointerEvents = 'none';
  };

  const mouseUpHandler = () => {
    resizer.style.removeProperty('cursor');
    document.body.style.removeProperty('cursor');

    leftSide.style.removeProperty('user-select');
    leftSide.style.removeProperty('pointer-events');

    rightSide.style.removeProperty('user-select');
    rightSide.style.removeProperty('pointer-events');

    document.body.dispatchEvent(new Event('resize'));

    document.removeEventListener('mousemove', mouseMoveHandler);
    document.removeEventListener('mouseup', mouseUpHandler);
  };

  resizer.addEventListener('mousedown', mouseDownHandler);
}
