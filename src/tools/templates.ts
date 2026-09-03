import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Client } from '../client.js';
import { ok, fail } from './respond.js';

const generateOptionsSchema = z
  .object({
    seed: z.number().optional().describe('Deterministic seed for the generated document.'),
    params: z.record(z.string(), z.unknown()).optional().describe('Values for getParam() references in the body.'),
    context: z.record(z.string(), z.unknown()).optional(),
  })
  .optional();

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
        name: z.string().describe('Template name.'),
        description: z.string().optional(),
        body: z.string().describe('Template body containing at least one function-call placeholder.'),
        tags: z.array(z.string()).optional(),
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
        name: z.string().optional(),
        status: z.enum(['active', 'archived']).optional(),
        tags: z.string().optional().describe('Comma-separated list of tags, e.g. "orders,email".'),
        cursor: z.string().optional(),
        limit: z.number().int().optional(),
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
        templateId: z.string(),
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
        templateId: z.string(),
        name: z.string().optional(),
        description: z.string().optional(),
        body: z.string().optional(),
        tags: z.array(z.string()).optional(),
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
        templateId: z.string(),
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
        templateId: z.string(),
        seed: z.number().optional(),
        params: z.record(z.string(), z.unknown()).optional(),
        context: z.record(z.string(), z.unknown()).optional(),
        sequenceNamespace: z.string().optional(),
        variableNamespace: z.string().optional(),
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
        body: z.string(),
        seed: z.number().optional(),
        params: z.record(z.string(), z.unknown()).optional(),
        context: z.record(z.string(), z.unknown()).optional(),
        sequenceNamespace: z.string().optional(),
        variableNamespace: z.string().optional(),
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
