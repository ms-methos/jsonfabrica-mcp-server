import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig } from './config.js';

test('loadConfig does not throw when JSONFABRICA_API_KEY is missing (warns, empty key)', () => {
  const originalError = console.error;
  const calls: string[] = [];
  console.error = (msg?: unknown) => { calls.push(String(msg)); };
  try {
    const config = loadConfig({});
    assert.equal(config.apiKey, '');
    assert.equal(config.apiUrl, 'https://api.jsonfabrica.com');
    assert.ok(calls.some((c) => /JSONFABRICA_API_KEY is not set/.test(c)));
  } finally {
    console.error = originalError;
  }
});

test('loadConfig defaults JSONFABRICA_API_URL to https://api.jsonfabrica.com', () => {
  const config = loadConfig({ JSONFABRICA_API_KEY: 'sk_test_123' });
  assert.equal(config.apiKey, 'sk_test_123');
  assert.equal(config.apiUrl, 'https://api.jsonfabrica.com');
});

test('loadConfig strips a trailing slash from JSONFABRICA_API_URL', () => {
  const config = loadConfig({
    JSONFABRICA_API_KEY: 'sk_test_123',
    JSONFABRICA_API_URL: 'https://api.example.com/',
  });
  assert.equal(config.apiUrl, 'https://api.example.com');
});

test('loadConfig passes through a custom JSONFABRICA_API_URL unchanged (no trailing slash)', () => {
  const config = loadConfig({
    JSONFABRICA_API_KEY: 'sk_test_123',
    JSONFABRICA_API_URL: 'https://api.example.com',
  });
  assert.equal(config.apiUrl, 'https://api.example.com');
});
