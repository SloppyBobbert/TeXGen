import { describe, expect, it } from 'vitest';
import { apiUrl } from './api';

describe('apiUrl', () => {
  it('keeps relative API paths when no production base URL is configured', () => {
    expect(apiUrl('/api/health/', '')).toBe('/api/health/');
  });

  it('prefixes API paths with a configured production API URL', () => {
    expect(apiUrl('/api/health/', 'https://texgen-api.onrender.com/')).toBe(
      'https://texgen-api.onrender.com/api/health/',
    );
  });
});
