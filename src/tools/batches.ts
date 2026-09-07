import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Client } from '../client.js';
import { ok, fail } from './respond.js';

const relationValueSchema = z.union([
  z
    .string()
    .describe(
      'Shorthand relation reference in the form "parentAlias" or "parentAlias.field.nested", pointing at a ' +
        'document from another `documents[]` entry (by its `alias`). Only valid when the referenced parent ' +
        'has `count === 1` — with `count > 1` the reference is ambiguous and the request is rejected with a ' +
        '400 error; use the object form with `strategy` instead.'
    ),
  z.object({
    from: z
      .string()
      .optional()
      .describe(
        'Same "parentAlias" or "parentAlias.field.nested" reference as the string form, but required here ' +
          'so a `strategy` can be attached — used when the referenced parent has `count > 1`.'
      ),
    strategy: z
      .enum(['round-robin'])
      .optional()
      .describe(
        'How to pick one of several parent documents when the referenced alias has `count > 1`. Only ' +
          '"round-robin" is currently supported (cycles through the parent\'s generated documents in order, ' +
          'wrapping around); any other value is rejected with a 400 UNSUPPORTED_STRATEGY error. Optional, ' +
          'but effectively required whenever the parent alias has `count > 1`.'
      ),
  }),
]);

const batchDocumentSpecSchema = z.object({
  templateId: z.string().describe('ID of the persisted template used to generate this document group. Required.'),
  alias: z
    .string()
    .describe(
      'Short name identifying this `documents[]` entry within the batch, used to reference it from other ' +
        'entries\' `relations` (and duplicated aliases across entries are rejected with a 400 error). Required.'
    ),
  count: z
    .number()
    .int()
    .describe('How many documents to generate from this template within the batch. Required; must be an integer.'),
  relations: z
    .record(z.string(), relationValueSchema)
    .optional()
    .describe(
      'Map of field name (as it appears in this template\'s generated output) to a reference into another ' +
        'alias in the same batch, letting generated documents cross-reference each other (e.g. an "orders" ' +
        'entry referencing a "customers" entry\'s id). Optional; omit for documents with no cross-references. ' +
        'Unknown aliases or dependency cycles across `documents[]` are rejected with a 400 error.'
    ),
  params: z
    .record(z.string(), z.unknown())
    .optional()
    .describe(
      'Key/value map supplying values for getParam("key") placeholders in this template\'s body, applied to ' +
        'every document generated for this alias. Optional; omitted keys leave the corresponding getParam() ' +
        'calls unresolved/empty.'
    ),
});

export function registerBatchTools(server: McpServer, client: Client): void {
  server.registerTool(
    'jsonfabrica_create_batch',
    {
      title: 'Create a JsonFabrica batch generation job',
      annotations: {
        title: 'Create a JsonFabrica batch generation job',
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
      description:
        'Calls POST /v1/batches. Generates multiple documents from one or more templates in one ' +
        'call, optionally cross-referencing documents via `relations`. Small batches run ' +
        'synchronously and the response is 200 with `results`; larger batches are queued and the ' +
        'response is 202 with just `{ batchId, status, seed }` — poll jsonfabrica_get_batch for ' +
        'the final results in that case.',
      inputSchema: {
        seed: z
          .number()
          .optional()
          .describe(
            'Deterministic PRNG seed applied across the whole batch — the same seed reproduces byte-identical ' +
              'random values for every document. Optional; if omitted the server picks a random seed and ' +
              'returns it in the response (`seed` in both sync and async cases).'
          ),
        sequenceNamespace: z
          .string()
          .optional()
          .describe(
            'Isolates createSeq()/getSeq() durable-sequence side effects for this whole batch under this ' +
              'namespace, so test/debug runs don\'t advance real tenant sequences. Optional; omitted means the ' +
              'default (unnamespaced) sequence scope is used.'
          ),
        variableNamespace: z
          .string()
          .optional()
          .describe(
            'Isolates durable-variable side effects for this whole batch under this namespace, analogous to ' +
              '`sequenceNamespace`. Optional; omitted means the default (unnamespaced) variable scope is used.'
          ),
        documents: z
          .array(batchDocumentSpecSchema)
          .describe(
            'One entry per group of documents to generate, each naming a `templateId`, a unique `alias`, how ' +
              'many (`count`) to generate, and optionally `relations`/`params`. Required; at least one entry. ' +
              'Entries are executed in dependency order (documents with `relations` are generated after the ' +
              'aliases they depend on).'
          ),
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
      annotations: {
        title: 'Get a JsonFabrica batch',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
      description:
        'Calls GET /v1/batches/{batchId}. Returns batch status and, once complete, the generated ' +
        'documents. Use this to poll a batch that was accepted asynchronously (202).',
      inputSchema: {
        batchId: z.string().describe('ID of the batch job to fetch, as returned by jsonfabrica_create_batch. Required.'),
      },
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
