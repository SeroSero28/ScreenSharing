import '@testing-library/jest-dom';
import { vi } from 'vitest';

// JSDOM'da bulunmayan scrollIntoView fonksiyonunu taklit et (mock)
window.HTMLElement.prototype.scrollIntoView = vi.fn();
