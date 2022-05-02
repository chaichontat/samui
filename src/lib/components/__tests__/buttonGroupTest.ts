import { render } from '@testing-library/svelte';
import ButtonGroup from '../buttonGroup.svelte';

const names = ['a', 'b'];

test('should render', () => {
  const results = render(ButtonGroup, { props: { names, color: 'blue' } });

  expect(() => results.getByText('a')).not.toThrow();
});

test('addNone', () => {
  const results = render(ButtonGroup, { props: { names, color: 'blue' } });
  expect(() => results.getByText('None')).not.toThrow();
});
