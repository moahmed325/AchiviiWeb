import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// jsdom doesn't implement scrolling.
window.scrollTo = () => {};

afterEach(() => {
  cleanup();
});
