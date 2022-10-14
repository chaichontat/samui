import { ImgData } from '$src/lib/data/objects/image';
import { sEvent } from '$src/lib/store';
import '@testing-library/jest-dom';
import {
  findByLabelText,
  fireEvent,
  getByLabelText,
  getByText,
  render,
  screen
} from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import type { UserEvent } from '@testing-library/user-event/dist/types/setup/setup';
import fc from 'fast-check';
import { cloneDeep, zip } from 'lodash-es';
import { describe, expect, it, vi, type MockedFunction } from 'vitest';

import FeatureSearchBox from '../featureSearchBox.svelte';

describe('feature search box', () => {
  let user: UserEvent;
  beforeEach(() => {
    user = userEvent.setup();
  });

  it('should show say no feature when no feature is loaded', async () => {
    render(FeatureSearchBox, { featureGroup: undefined });
    const search = screen.getByPlaceholderText('No feature');
    expect(search).toBeInTheDocument();
    expect(search).toHaveAttribute('disabled');
    await user.click(search);
    expect(screen.getByLabelText('Search result box').classList.contains('hidden'));
  });

  it('should be responsive to typing', async () => {
    const featureGroup = [
      { group: 'a', features: ['target', 'zulu'] },
      { group: 'b', features: ['hmm', 'bb'] }
    ];
    render(FeatureSearchBox, { featureGroup });

    const search = screen.getByPlaceholderText('Search features');
    const box = screen.getByLabelText('Search result box');
    expect(search).toBeInTheDocument();

    expect(box.classList.contains('hidden'));
    await user.click(search);
    expect(box.classList.contains('hidden')).not;

    expect(screen.queryByText('z')).not.toBeInTheDocument();
    await user.type(search, 'zu');
    const z = screen.getByText('z');
    expect(z).toBeInTheDocument();
    expect(z.tagName === 'b'); // selective bold of fzf
    expect(screen.getByText('u')).toBeInTheDocument();
    expect(screen.getByText('lu')).toBeInTheDocument();
  });

  it('should hide on click outside and reappear when typed', async () => {
    const featureGroup = [
      { group: 'a', features: ['target', 'zulu'] },
      { group: 'b', features: ['hmm', 'bb'] }
    ];
    render(FeatureSearchBox, { featureGroup });
    const search = screen.getByPlaceholderText('Search features');
    await user.type(search, 'zu');
    const dump = document.createElement('div');
    search.append(dump);
    await user.click(dump);
    expect(screen.getByLabelText('Search result box').classList.contains('hidden'));
    await user.type(search, 'zu');
    expect(screen.getByLabelText('Search result box').classList.contains('hidden')).not;
  });
});
