import { render } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CoordsData } from '../coords';

describe('CoordsData', () => {
  it('should run', () => {
    const coords = new CoordsData({
      name: 'test',
      shape: 'circle',
      mPerPx: 1,
      pos: [{ x: 1, y: 1 }]
    });
  });
});
