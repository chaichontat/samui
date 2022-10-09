import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe } from 'vitest';
import Feedback from '../Feedback.svelte';

describe('test feedback', () => {
  it('should show feedback', async () => {
    render(Feedback);
    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();

    await fireEvent.click(button);
    const box = screen.getByPlaceholderText((id) => id === 'Input your feedback here.');
    expect(box).toBeInTheDocument();
    box.textContent = 'test';
    const submit = screen.getByRole('button', { name: 'submit' });
    expect(submit).toBeInTheDocument();
    // await fireEvent.click(submit);
  });
});

// MSW does not support ES modules.
