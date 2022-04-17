import LRU from 'lru-cache';
import tippy from 'tippy.js';

export function genLRU<K extends unknown[], V>(f: (...args: K) => V, max = 100): (...args: K) => V {
  const cache = new LRU<string, V>({ max });
  return (...args: K): V => {
    const key = JSON.stringify(args);
    if (cache.has(key)) return cache.get(key) as V; // Checked
    const r = f(...args);
    cache.set(key, r);
    return r;
  };
}

export function debounce<T extends unknown[], R>(f: (...args: T) => R, timeout = 300) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return (...args: T) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => f(...args) as unknown as void, timeout);
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

export function tooltip(node: HTMLElement, content: string) {
  node.setAttribute('aria-label', content);
  node.title = '';
  const tip = tippy(node, { content, delay: [100, 0] });
  return {
    update: (newmsg: string): void => tip.setContent(newmsg),
    destroy: (): void => tip.destroy()
  };
}

function interpolateTurbo(x: number) {
  x = Math.max(0, Math.min(1, x));
  return (
    '#' +
    [
      34.61 + x * (1172.33 - x * (10793.56 - x * (33300.12 - x * (38394.49 - x * 14825.05)))),
      23.31 + x * (557.33 + x * (1225.33 - x * (3574.96 - x * (1073.77 + x * 707.56)))),
      27.2 + x * (3211.1 - x * (15327.97 - x * (27814 - x * (22569.18 - x * 6838.66))))
    ]
      .map(Math.floor)
      .map((x) => Math.max(0, Math.min(255, x)).toString(16).padStart(2, '0'))
      .join('')
  );
}
