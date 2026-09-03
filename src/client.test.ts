import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from './client.js';
import { ApiError } from './errors.js';
import type { Config } from './config.js';

const config: Config = { apiKey: 'sk_test_123', apiUrl: 'http://localhost:4000' };

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

test('request() parses a successful JSON response and sends the Authorization header', async () => {
  let capturedInit: RequestInit | undefined;
  let capturedUrl: string | undefined;
  const fetchImpl = (async (url: string, init?: RequestInit) => {
    capturedUrl = url;
    capturedInit = init;
    return jsonResponse(200, { ok: true });
  }) as typeof fetch;

  const client = createClient(config, fetchImpl);
  const result = await client.request<{ ok: boolean }>({ method: 'GET', path: '/v1/whoami' });

  assert.deepEqual(result, { ok: true });
  assert.equal(capturedUrl, 'http://localhost:4000/v1/whoami');
  const headers = capturedInit?.headers as Record<string, string>;
  assert.equal(headers.authorization, 'Bearer sk_test_123');
});

test('request() omits the Authorization header when noAuth is set (health check)', async () => {
  let capturedInit: RequestInit | undefined;
  const fetchImpl = (async (_url: string, init?: RequestInit) => {
    capturedInit = init;
    return jsonResponse(200, { status: 'ok' });
  }) as typeof fetch;

  const client = createClient(config, fetchImpl);
  await client.request({ method: 'GET', path: '/health', noAuth: true });

  const headers = capturedInit?.headers as Record<string, string>;
  assert.equal(headers.authorization, undefined);
});

test('request() builds a query string from provided params, skipping undefined values', async () => {
  let capturedUrl: string | undefined;
  const fetchImpl = (async (url: string) => {
    capturedUrl = url;
    return jsonResponse(200, {});
  }) as typeof fetch;

  const client = createClient(config, fetchImpl);
  await client.request({
    method: 'GET',
    path: '/v1/templates',
    query: { name: 'foo', status: undefined, limit: 10 },
  });

  assert.equal(capturedUrl, 'http://localhost:4000/v1/templates?name=foo&limit=10');
});

test('request() maps a non-2xx JSON error envelope to ApiError', async () => {
  const fetchImpl = (async () =>
    jsonResponse(404, { error: { code: 'NOT_FOUND', message: 'Template not found', details: { id: 'tpl_1' } } })) as typeof fetch;

  const client = createClient(config, fetchImpl);
  await assert.rejects(
    () => client.request({ method: 'GET', path: '/v1/templates/tpl_1' }),
    (err: unknown) => {
      assert.ok(err instanceof ApiError);
      assert.equal(err.code, 'NOT_FOUND');
      assert.equal(err.message, 'Template not found');
      assert.equal(err.httpStatus, 404);
      assert.deepEqual(err.details, { id: 'tpl_1' });
      return true;
    }
  );
});

test('request() falls back to raw status text when the error body is not valid JSON', async () => {
  const fetchImpl = (async () =>
    new Response('Internal Server Error', { status: 500, statusText: 'Internal Server Error' })) as typeof fetch;

  const client = createClient(config, fetchImpl);
  await assert.rejects(
    () => client.request({ method: 'GET', path: '/v1/templates' }),
    (err: unknown) => {
      assert.ok(err instanceof ApiError);
      assert.equal(err.httpStatus, 500);
      assert.equal(err.code, 'HTTP_500');
      return true;
    }
  );
});

test('request() maps a network failure (fetch throws) to UPSTREAM_UNREACHABLE', async () => {
  const fetchImpl = (async () => {
    throw new Error('ECONNREFUSED');
  }) as typeof fetch;

  const client = createClient(config, fetchImpl);
  await assert.rejects(
    () => client.request({ method: 'GET', path: '/health', noAuth: true }),
    (err: unknown) => {
      assert.ok(err instanceof ApiError);
      assert.equal(err.code, 'UPSTREAM_UNREACHABLE');
      assert.match(err.message, /ECONNREFUSED/);
      return true;
    }
  );
});

test('request() returns undefined for a 204 No Content response', async () => {
  const fetchImpl = (async () => new Response(null, { status: 204 })) as typeof fetch;
  const client = createClient(config, fetchImpl);
  const result = await client.request({ method: 'DELETE', path: '/v1/templates/tpl_1' });
  assert.equal(result, undefined);
});
