import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ApiError, describeError } from './errors.js';

test('describeError gives a friendly message for 401 UNAUTHORIZED', () => {
  const msg = describeError(new ApiError('UNAUTHORIZED', 'no token', undefined, 401));
  assert.match(msg, /Invalid or missing API key/);
});

test('describeError gives a friendly message for 403 FORBIDDEN', () => {
  const msg = describeError(new ApiError('FORBIDDEN', 'nope', undefined, 403));
  assert.match(msg, /does not have admin role/);
});

test('describeError passes through blockReason for 402 payment required', () => {
  const msg = describeError(new ApiError('PAYMENT_REQUIRED', 'blocked', { blockReason: 'free tier expired' }, 402));
  assert.match(msg, /free tier expired/);
});

test('describeError falls back to a generic formatted message for other errors', () => {
  const msg = describeError(new ApiError('NOT_FOUND', 'Template not found', undefined, 404));
  assert.equal(msg, 'JsonFabrica API error [NOT_FOUND] (HTTP 404): Template not found');
});

test('describeError wraps a plain Error (non-ApiError) as UNKNOWN', () => {
  const msg = describeError(new Error('boom'));
  assert.equal(msg, 'JsonFabrica API error [UNKNOWN] (HTTP ?): boom');
});
