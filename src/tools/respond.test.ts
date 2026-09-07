import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ok, fail } from './respond.js';

test('ok() produces a valid MCP TextContent block for every result shape', () => {
  const cases: Array<{ name: string; input: unknown; expectedText: string }> = [
    { name: 'undefined (204 No Content / empty body)', input: undefined, expectedText: 'OK (no content)' },
    { name: 'object', input: { id: 'seq_1', name: 'orders' }, expectedText: JSON.stringify({ id: 'seq_1', name: 'orders' }, null, 2) },
    { name: 'array', input: [1, 2, 3], expectedText: JSON.stringify([1, 2, 3], null, 2) },
    { name: 'null', input: null, expectedText: 'null' },
    { name: 'empty string', input: '', expectedText: '""' },
    { name: 'number', input: 0, expectedText: '0' },
  ];

  for (const { name, input, expectedText } of cases) {
    const response = ok(input);
    assert.equal(response.content.length, 1, `[${name}] exactly one content block`);
    const block = response.content[0];
    assert.equal(block.type, 'text', `[${name}] block type is text`);
    assert.equal(typeof block.text, 'string', `[${name}] text must be a string (MCP TextContent schema)`);
    assert.equal(block.text, expectedText, `[${name}] text matches expected rendering`);
  }
});

test('ok() attaches structuredContent matching the raw result for object results', () => {
  const response = ok({ id: 'seq_1', name: 'orders' });
  assert.deepEqual((response as { structuredContent?: unknown }).structuredContent, { id: 'seq_1', name: 'orders' });
});

test('ok() wraps a bare-array result as { items: [...] } for structuredContent (outputSchema must be an object shape)', () => {
  const response = ok([1, 2, 3]);
  assert.deepEqual((response as { structuredContent?: unknown }).structuredContent, { items: [1, 2, 3] });
});

test('ok(undefined) never attaches structuredContent (204/no-body case — tool must have no outputSchema)', () => {
  const response = ok(undefined);
  assert.equal('structuredContent' in response, false);
});

test('ok(undefined) never returns the bare JS value undefined as text (regression for DELETE 204 crash)', () => {
  const response = ok(undefined);
  // The bug: JSON.stringify(undefined, null, 2) === undefined (not a string),
  // which fails MCP TextContent validation in spec-compliant clients.
  assert.notEqual(response.content[0].text, undefined);
  assert.equal(typeof response.content[0].text, 'string');
});

test('fail() wraps an error into an isError text response', () => {
  const response = fail(new Error('boom'));
  assert.equal(response.isError, true);
  assert.equal(typeof response.content[0].text, 'string');
  assert.match(response.content[0].text, /boom/);
});
