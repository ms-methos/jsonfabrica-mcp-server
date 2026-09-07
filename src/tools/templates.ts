import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Client } from '../client.js';
import { ok, fail } from './respond.js';

const generateOptionsSchema = z
  .object({
    seed: z
      .number()
      .optional()
      .describe(
        'Deterministic PRNG seed for this generation — the same seed plus the same template body/params ' +
          'reproduces byte-identical random values. Optional; if omitted the server picks a random seed ' +
          'and returns it in the response so the result can be reproduced later.'
      ),
    params: z
      .record(z.string(), z.unknown())
      .optional()
      .describe(
        'Key/value map supplying values for getParam("key") placeholders referenced in the template body. ' +
          'Optional; omitted keys leave the corresponding getParam() calls unresolved/empty. Not related to ' +
          'sequence or variable namespacing.'
      ),
    context: z
      .record(z.string(), z.unknown())
      .optional()
      .describe(
        'Arbitrary key/value data made available to the template body alongside `params` (implementation- ' +
          'specific auxiliary context, e.g. for conditional logic). Optional; omitted keys are simply absent ' +
          'during generation.'
      ),
  })
  .optional()
  .describe(
    'When present, immediately generates one document from the just-created template using these options; ' +
      'the response then includes `generation`/`generationError` alongside `template`. Optional — omit to ' +
      'only create the template record with no generation side effects.'
  );

export function registerTemplateTools(server: McpServer, client: Client): void {
  server.registerTool(
    'jsonfabrica_create_template',
    {
      title: 'Create a JsonFabrica template',
      description:
        'Calls POST /v1/templates. Creates a reusable template. `body` uses ' +
        "JsonFabrica's function-call placeholder syntax, e.g. \"Hello {{getRandomFullName()}}\" " +
        'or "<getRandomNumber(1,100)>" — see the data-generation-functions reference for the full ' +
        'catalog. If `generate` is provided, a document is generated from the newly-created ' +
        'template in the same call (response includes `generation` or `generationError` alongside ' +
        '`template`); if omitted, the response is just the created template.',
      inputSchema: {
        name: z.string().describe('Template name. Required; not required to be unique per tenant.'),
        description: z
          .string()
          .optional()
          .describe('Free-text human-readable description of the template\'s purpose. Optional; omitted means none stored.'),
        body: z.string().describe('Template body containing at least one function-call placeholder. Required.'),
        tags: z
          .array(z.string())
          .optional()
          .describe(
            'Labels for later filtering via jsonfabrica_list_templates\' `tags` parameter (AND-match: a ' +
              'template must contain every requested tag). Optional; omitted or empty means no tags stored.'
          ),
        generate: generateOptionsSchema,
      },
    },
    async (args) => {
      try {
        const result = await client.request({ method: 'POST', path: '/v1/templates', body: args });
        return ok(result);
      } catch (err) {
        return fail(err);
      }
    }
  );

  server.registerTool(
    'jsonfabrica_list_templates',
    {
      title: 'List JsonFabrica templates',
      description: 'Calls GET /v1/templates. Returns a page of templates (`{ items, nextCursor }`).',
      inputSchema: {
        name: z
          .string()
          .optional()
          .describe(
            'Filters to templates whose `name` contains this text — a case-insensitive substring match, not ' +
              'an exact match. Optional; omit to match templates of any name.'
          ),
        status: z
          .enum(['active', 'archived'])
          .optional()
          .describe(
            '`active` returns only non-deleted templates, `archived` returns only soft-deleted ones. ' +
              'Optional; defaults to `active` when omitted (archived templates are excluded unless requested).'
          ),
        tags: z
          .string()
          .optional()
          .describe(
            'Comma-separated list of tags, e.g. "orders,email". AND-match: a template must contain every ' +
              'listed tag to be included (not "any of"). Optional; omit to ignore tags entirely.'
          ),
        cursor: z
          .string()
          .optional()
          .describe(
            'Opaque pagination cursor taken verbatim from a previous response\'s `nextCursor`. Optional; omit ' +
              'to fetch the first page.'
          ),
        limit: z
          .number()
          .int()
          .optional()
          .describe(
            'Maximum number of templates to return in this page. Optional; defaults to 20 when omitted, ' +
              'capped at a server-enforced maximum of 100.'
          ),
      },
    },
    async (args) => {
      try {
        const result = await client.request({ method: 'GET', path: '/v1/templates', query: args });
        return ok(result);
      } catch (err) {
        return fail(err);
      }
    }
  );

  server.registerTool(
    'jsonfabrica_get_template',
    {
      title: 'Get a JsonFabrica template',
      description: 'Calls GET /v1/templates/{templateId}. Returns the full template record.',
      inputSchema: {
        templateId: z.string().describe('ID of the template to fetch, as returned by create/list. Required.'),
      },
    },
    async ({ templateId }) => {
      try {
        const result = await client.request({ method: 'GET', path: `/v1/templates/${encodeURIComponent(templateId)}` });
        return ok(result);
      } catch (err) {
        return fail(err);
      }
    }
  );

  server.registerTool(
    'jsonfabrica_update_template',
    {
      title: 'Update a JsonFabrica template',
      description: 'Calls PUT /v1/templates/{templateId}. Only the provided fields are changed.',
      inputSchema: {
        templateId: z.string().describe('ID of the template to update. Required.'),
        name: z
          .string()
          .optional()
          .describe('New template name. Optional; omit to leave the current name unchanged.'),
        description: z
          .string()
          .optional()
          .describe('New free-text description, replacing the existing one. Optional; omit to leave it unchanged.'),
        body: z
          .string()
          .optional()
          .describe(
            'New template body (function-call placeholder syntax), replacing the existing one entirely. ' +
              'Optional; omit to leave the current body unchanged.'
          ),
        tags: z
          .array(z.string())
          .optional()
          .describe(
            'New full set of tags, replacing (not merging with) the existing tags. Optional; omit to leave ' +
              'the current tags unchanged; pass an empty array to clear all tags.'
          ),
      },
    },
    async ({ templateId, ...body }) => {
      try {
        const result = await client.request({
          method: 'PUT',
          path: `/v1/templates/${encodeURIComponent(templateId)}`,
          body,
        });
        return ok(result);
      } catch (err) {
        return fail(err);
      }
    }
  );

  server.registerTool(
    'jsonfabrica_delete_template',
    {
      title: 'Delete a JsonFabrica template',
      description: 'Calls DELETE /v1/templates/{templateId}. Returns the removed template record.',
      inputSchema: {
        templateId: z.string().describe('ID of the template to delete. Required.'),
      },
    },
    async ({ templateId }) => {
      try {
        const result = await client.request({
          method: 'DELETE',
          path: `/v1/templates/${encodeURIComponent(templateId)}`,
        });
        return ok(result);
      } catch (err) {
        return fail(err);
      }
    }
  );

  server.registerTool(
    'jsonfabrica_generate_from_template',
    {
      title: 'Generate a document from a JsonFabrica template',
      description:
        'Calls POST /v1/templates/{templateId}/generate. Generates a document using a persisted ' +
        'template. Set `sequenceNamespace`/`variableNamespace` to isolate sequence/variable side ' +
        'effects between environments.',
      inputSchema: {
        templateId: z.string().describe('ID of the persisted template to generate a document from. Required.'),
        seed: z
          .number()
          .optional()
          .describe(
            'Deterministic PRNG seed for this generation — the same seed reproduces byte-identical random ' +
              'values. Optional; if omitted the server picks a random seed and returns it in the response.'
          ),
        params: z
          .record(z.string(), z.unknown())
          .optional()
          .describe(
            'Key/value map supplying values for getParam("key") placeholders in the template body. Optional; ' +
              'omitted keys leave the corresponding getParam() calls unresolved/empty.'
          ),
        context: z
          .record(z.string(), z.unknown())
          .optional()
          .describe(
            'Arbitrary auxiliary key/value data made available to the template body alongside `params`. ' +
              'Optional; omitted keys are simply absent during generation.'
          ),
        sequenceNamespace: z
          .string()
          .optional()
          .describe(
            'Isolates createSeq()/getSeq() durable-sequence side effects under this namespace so repeated ' +
              'test/debug runs don\'t advance real tenant sequences. Optional; omitted means the default ' +
              '(unnamespaced) sequence scope is used.'
          ),
        variableNamespace: z
          .string()
          .optional()
          .describe(
            'Isolates durable-variable side effects under this namespace, analogous to `sequenceNamespace`. ' +
              'Optional; omitted means the default (unnamespaced) variable scope is used.'
          ),
      },
    },
    async ({ templateId, ...body }) => {
      try {
        const result = await client.request({
          method: 'POST',
          path: `/v1/templates/${encodeURIComponent(templateId)}/generate`,
          body,
        });
        return ok(result);
      } catch (err) {
        return fail(err);
      }
    }
  );

  server.registerTool(
    'jsonfabrica_generate_adhoc',
    {
      title: 'Generate a document from a raw template body (no persistence)',
      description:
        'Calls POST /v1/templates/generate. Generates a document directly from a raw `body` string ' +
        'without creating a template record — useful for quickly iterating on template syntax. ' +
        'Goes through the same billing/usage metering as persisted-template generation (not a free ' +
        "bypass). createSeq()/durable sequence side effects still apply; set `sequenceNamespace`/ " +
        '`variableNamespace` to e.g. "debug" to avoid colliding with real tenant sequences.',
      inputSchema: {
        body: z
          .string()
          .describe(
            'Raw template body containing at least one function-call placeholder, e.g. ' +
              '"Hello {{getRandomFullName()}}" — evaluated directly without persisting a template record. ' +
              'Required.'
          ),
        seed: z
          .number()
          .optional()
          .describe(
            'Deterministic PRNG seed for this generation — the same seed reproduces byte-identical random ' +
              'values. Optional; if omitted the server picks a random seed and returns it in the response.'
          ),
        params: z
          .record(z.string(), z.unknown())
          .optional()
          .describe(
            'Key/value map supplying values for getParam("key") placeholders in `body`. Optional; omitted ' +
              'keys leave the corresponding getParam() calls unresolved/empty.'
          ),
        context: z
          .record(z.string(), z.unknown())
          .optional()
          .describe(
            'Arbitrary auxiliary key/value data made available to `body` alongside `params`. Optional; ' +
              'omitted keys are simply absent during generation.'
          ),
        sequenceNamespace: z
          .string()
          .optional()
          .describe(
            'Isolates createSeq()/getSeq() durable-sequence side effects under this namespace, e.g. "debug", ' +
              'so ad-hoc runs don\'t advance real tenant sequences. Optional; omitted means the default ' +
              '(unnamespaced) sequence scope is used.'
          ),
        variableNamespace: z
          .string()
          .optional()
          .describe(
            'Isolates durable-variable side effects under this namespace, analogous to `sequenceNamespace`. ' +
              'Optional; omitted means the default (unnamespaced) variable scope is used.'
          ),
      },
    },
    async (args) => {
      try {
        const result = await client.request({ method: 'POST', path: '/v1/templates/generate', body: args });
        return ok(result);
      } catch (err) {
        return fail(err);
      }
    }
  );
}
