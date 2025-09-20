import { vi } from 'vitest';

const consoleErrorMock = vi.fn();
console.error = consoleErrorMock;
window.alert = consoleErrorMock;
console.log = vi.fn();
prompt = () => true;
