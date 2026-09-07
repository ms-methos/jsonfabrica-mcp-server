import { test } from 'node:test';
import assert from 'node:assert/strict';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createClient } from './client.js';
import { registerAllTools } from './tools/index.js';
import type { Config } from './config.js';

const config: Config = { apiKey: 'sk_test_123', apiUrl: 'http://localhost:4000' };

/**
 * Boots a real McpServer (every tool registered, including outputSchema)
 * wired to a stubbed gateway `fetch`, connects an SDK Client to it over an
 * in-memory transport, and returns both. This is the regression guard for
 * outputSchema + structuredContent: the SDK Client validates
 * `tools/call` results against each tool's declared `outputSchema` and
 * throws "Invalid tools/call result" / "Invalid structured content" if a
 * handler's response doesn't conform — a plain unit test calling the
 * handler function directly would not exercise that validation.
 */
async function startLinkedClient(fetchImpl: typeof fetch): Promise<{ client: Client; close: () => Promise<void> }> {
  const server = new McpServer({ name: 'test-server', version: '0.0.0' });
  registerAllTools(server, createClient(config, fetchImpl));

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test-client', version: '0.0.0' });

  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  return {
    client,
    close: async () => {
      await client.close();
      await server.close();
    },
  };
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

test('jsonfabrica_health: SDK Client accepts the result and structuredContent matches the outputSchema', async () => {
  const fetchImpl = (async () => jsonResponse(200, { status: 'ok', service: 'svc-gateway' })) as typeof fetch;
  const { client, close } = await startLinkedClient(fetchImpl);
  try {
    const result = await client.callTool({ name: 'jsonfabrica_health', arguments: {} });
    assert.equal(result.isError, undefined);
    assert.deepEqual(result.structuredContent, { status: 'ok', service: 'svc-gateway' });
    assert.equal(Array.isArray(result.content), true);
  } finally {
    await close();
  }
});

test('jsonfabrica_list_templates: a list-tool response validates against its { items, nextCursor } outputSchema', async () => {
  const page = {
    items: [
      {
        templateId: 'tpl_1',
        tenantId: 'tenant-acme-01',
        name: 'Order Confirmation',
        body: "Hello <getParam('name')>",
        tags: ['orders'],
        validated: true,
        status: 'active',
        createdAt: '2026-07-23T09:00:00.000Z',
        updatedAt: '2026-07-23T09:00:00.000Z',
      },
    ],
    nextCursor: 'eyJvZmZzZXQiOjIwfQ==',
  };
  const fetchImpl = (async () => jsonResponse(200, page)) as typeof fetch;
  const { client, close } = await startLinkedClient(fetchImpl);
  try {
    const result = await client.callTool({ name: 'jsonfabrica_list_templates', arguments: {} });
    assert.equal(result.isError, undefined);
    assert.deepEqual(result.structuredContent, page);
  } finally {
    await close();
  }
});

test('jsonfabrica_list_function_weights: bare-array gateway response is wrapped as { items } to satisfy the object outputSchema', async () => {
  const weights = [{ functionName: 'randomInt', weight: 1, updatedAt: '2026-07-01T00:00:00.000Z' }];
  const fetchImpl = (async () => jsonResponse(200, weights)) as typeof fetch;
  const { client, close } = await startLinkedClient(fetchImpl);
  try {
    const result = await client.callTool({ name: 'jsonfabrica_list_function_weights', arguments: {} });
    assert.equal(result.isError, undefined);
    assert.deepEqual(result.structuredContent, { items: weights });
  } finally {
    await close();
  }
});

test('jsonfabrica_delete_sequence: 204/no-body response is accepted with no structuredContent (tool has no outputSchema)', async () => {
  const fetchImpl = (async () => new Response(null, { status: 204 })) as typeof fetch;
  const { client, close } = await startLinkedClient(fetchImpl);
  try {
    const result = await client.callTool({ name: 'jsonfabrica_delete_sequence', arguments: { name: 'orderNo' } });
    assert.equal(result.isError, undefined);
    assert.equal(result.structuredContent, undefined);
    assert.equal((result.content as Array<{ text: string }>)[0].text, 'OK (no content)');
  } finally {
    await close();
  }
});

test('jsonfabrica_get_usage: error responses still surface as isError, not an SDK-level throw', async () => {
  const fetchImpl = (async () => jsonResponse(401, { error: { code: 'UNAUTHORIZED', message: 'Missing or invalid API key' } })) as typeof fetch;
  const { client, close } = await startLinkedClient(fetchImpl);
  try {
    const result = await client.callTool({ name: 'jsonfabrica_get_usage', arguments: {} });
    assert.equal(result.isError, true);
  } finally {
    await close();
  }
});
