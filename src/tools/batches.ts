import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Client } from '../client.js';
import { ok, fail } from './respond.js';

const relationValueSchema = z.union([
  z.string(),
  z.object({
    from: z.string().optional(),
    strategy: z.enum(['by-index', 'round-robin']).optional(),
  }),
]);

const batchDocumentSpecSchema = z.object({
  templateId: z.string(),
  alias: z.string(),
  count: z.number().int(),
  relations: z.record(z.string(), relationValueSchema).optional(),
  params: z.record(z.string(), z.unknown()).optional(),
});

export function registerBatchTools(server: McpServer, client: Client): void {
  server.registerTool(
    'jsonfabrica_create_batch',
    {
      title: 'Create a JsonFabrica batch generation job',
      description:
        'Calls POST /v1/batches. Generates multiple documents from one or more templates in one ' +
        'call, optionally cross-referencing documents via `relations`. Small batches run ' +
        'synchronously and the response is 200 with `results`; larger batches are queued and the ' +
        'response is 202 with just `{ batchId, status, seed }` — poll jsonfabrica_get_batch for ' +
        'the final results in that case.',
      inputSchema: {
        seed: z.number().optional(),
        sequenceNamespace: z.string().optional(),
        variableNamespace: z.string().optional(),
        documents: z.array(batchDocumentSpecSchema),
      },
    },
    async (args) => {
      try {
        return ok(await client.request({ method: 'POST', path: '/v1/batches', body: args }));
      } catch (err) {
        return fail(err);
      }
    }
  );

  server.registerTool(
    'jsonfabrica_get_batch',
    {
      title: 'Get a JsonFabrica batch',
      description:
        'Calls GET /v1/batches/{batchId}. Returns batch status and, once complete, the generated ' +
        'documents. Use this to poll a batch that was accepted asynchronously (202).',
      inputSchema: { batchId: z.string() },
    },
    async ({ batchId }) => {
      try {
        return ok(await client.request({ method: 'GET', path: `/v1/batches/${encodeURIComponent(batchId)}` }));
      } catch (err) {
        return fail(err);
      }
    }
  );
}
