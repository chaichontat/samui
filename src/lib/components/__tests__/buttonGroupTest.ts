import { render } from '@testing-library/svelte';
import ButtonGroup from '../buttonGroup.svelte';

test('should render', () => {
  const results = render(ButtonGroup, { props: { names: ['a', 'b'], color: 'blue' } });

  expect(() => results.getByText('a')).not.toThrow();
});
