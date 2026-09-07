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

// Mirrors TemplateDto in api-docs/openapi-external-gateway.yaml.
const templateDtoShape = {
  templateId: z.string().describe('Server-assigned template id.'),
  tenantId: z.string().describe('Owning tenant id.'),
  name: z.string().describe('Template name.'),
  description: z.string().optional().nullable().describe('Free-text description, if any was stored.'),
  body: z.string().describe('Template body containing function-call placeholders.'),
  astCache: z.array(z.unknown()).optional().nullable().describe('Server-internal parsed-body cache; opaque to callers.'),
  tags: z.array(z.string()).optional().describe('Tags stored on the template.'),
  validated: z.boolean().optional().describe('Whether the body passed static template validation.'),
  warnings: z.array(z.string()).optional().describe('Non-fatal validation warnings, if any.'),
  status: z.enum(['active', 'archived']).describe('"active" unless soft-deleted via jsonfabrica_delete_template.'),
  createdAt: z.string().describe('ISO-8601 creation timestamp.'),
  updatedAt: z.string().describe('ISO-8601 last-update timestamp.'),
};

// Mirrors GenerateResponseDto / AdhocGenerateResponseDto — fields present depend on which endpoint was called.
const generationResultShape = {
  data: z.unknown().describe('The generated document; shape is entirely determined by the template body.'),
  meta: z
    .object({
      seed: z.number().optional().describe('PRNG seed actually used for this generation.'),
      templateId: z.string().optional().describe('Present when generated from a persisted template.'),
      generatedAt: z.string().optional().describe('ISO-8601 timestamp of generation.'),
      documentSeed: z.number().optional().describe('Per-document seed, present for some generation paths.'),
    })
    .describe('Generation metadata.'),
};

export function registerTemplateTools(server: McpServer, client: Client): void {
  server.registerTool(
    'jsonfabrica_create_template',
    {
      title: 'Create a JsonFabrica template',
      annotations: {
        title: 'Create a JsonFabrica template',
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
      description:
        'Calls POST /v1/templates. Creates a persisted, reusable template that can be generated from ' +
        'repeatedly with jsonfabrica_generate_from_template — use this instead of jsonfabrica_generate_adhoc ' +
        'when you want the body saved and shareable rather than a one-off, unsaved evaluation. `body` uses ' +
        "JsonFabrica's function-call placeholder syntax, e.g. \"Hello {{getRandomFullName()}}\" " +
        'or "<getRandomNumber(1,100)>" — see the data-generation-functions reference for the full ' +
        'catalog. The optional `generate` field is a convenience that also runs a generation in the same ' +
        'call (response includes `generation` or `generationError` alongside `template`) so you avoid a ' +
        'separate jsonfabrica_generate_from_template round-trip; that generation is metered/billed and can ' +
        'advance durable sequences/variables just like a normal generate call. If `generate` is omitted, the ' +
        'response is just the created template with no generation side effects.',
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
      outputSchema: {
        // Plain TemplateDto fields when `generate` was omitted...
        ...templateDtoShape,
        templateId: templateDtoShape.templateId.optional(),
        tenantId: templateDtoShape.tenantId.optional(),
        name: templateDtoShape.name.optional(),
        body: templateDtoShape.body.optional(),
        status: templateDtoShape.status.optional(),
        createdAt: templateDtoShape.createdAt.optional(),
        updatedAt: templateDtoShape.updatedAt.optional(),
        // ...or { template, generation | generationError } when `generate` was present.
        template: z.object(templateDtoShape).optional().describe('Present when `generate` was passed; the created template record.'),
        generation: z
          .object(generationResultShape)
          .optional()
          .describe('Present when `generate` was passed and the immediate generation succeeded.'),
        generationError: z
          .object({ code: z.string(), message: z.string() })
          .optional()
          .describe('Present when `generate` was passed but the immediate generation failed at runtime (template was still created).'),
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
      annotations: {
        title: 'List JsonFabrica templates',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
      description:
        'Calls GET /v1/templates. Returns a page of templates matching optional `name`/`tags`/`status` ' +
        'filters (`{ items, nextCursor }`). Use this to discover or search templates when you don\'t already ' +
        'know the `templateId`; if you already have the id, call jsonfabrica_get_template directly instead — ' +
        'it is cheaper and returns the full record. This is read-only and has no side effects. Pass ' +
        '`status: "archived"` to see templates previously removed with jsonfabrica_delete_template, since ' +
        'the default `active` filter excludes them.',
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
            'Maximum number of templates to return in this page. Optional; defaults to 20 when omitted. ' +
              'Values <= 0 or > 100 are not clamped — the request is rejected with a 400 validation error.'
          ),
      },
      outputSchema: {
        items: z.array(z.object(templateDtoShape)).describe('Page of matching templates.'),
        nextCursor: z.string().optional().describe('Pass to `cursor` on the next call to fetch the following page; absent on the last page.'),
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
      annotations: {
        title: 'Get a JsonFabrica template',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
      description:
        'Calls GET /v1/templates/{templateId}. Returns the full template record for a known id. Use this ' +
        'instead of jsonfabrica_list_templates when you already have the `templateId` (e.g. from a prior ' +
        'create/list call); it is also the recommended way to inspect current `body`/`tags`/`description` ' +
        'before calling jsonfabrica_update_template, since update only shows you the fields you send, not the ' +
        'result of merging them with what already exists. Read-only, no side effects.',
      inputSchema: {
        templateId: z.string().describe('ID of the template to fetch, as returned by create/list. Required.'),
      },
      outputSchema: templateDtoShape,
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
      annotations: {
        title: 'Update a JsonFabrica template',
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
      description:
        'Calls PUT /v1/templates/{templateId}. Partially updates an existing template in place: only the ' +
        'fields you include in the call are changed, and every field you omit is left exactly as it was — ' +
        'call jsonfabrica_get_template first if you need to see current values before deciding what to send. ' +
        'Use this only for an existing `templateId`; to make a new template use jsonfabrica_create_template ' +
        'instead (it does not modify or version the original). The change is applied immediately and ' +
        'in-place with no version history — there is no undo, so if you need to keep the old `body`/`tags` ' +
        'around, read and save them first.',
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
      outputSchema: templateDtoShape,
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
      annotations: {
        title: 'Delete a JsonFabrica template',
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
      description:
        'Calls DELETE /v1/templates/{templateId}. This is a soft delete: the template\'s `status` is set to ' +
        '"archived" (it is not erased from storage), and the call returns the resulting archived template ' +
        'record. Archived templates are excluded from jsonfabrica_list_templates by default — pass ' +
        '`status: "archived"` there to find them again — and both jsonfabrica_get_template and ' +
        'jsonfabrica_generate_from_template still work against the id afterwards, since archiving does not ' +
        'block reads or generation. Use this when a template should stop showing up in normal listings; there ' +
        'is currently no tool to restore an archived template back to `active`.',
      inputSchema: {
        templateId: z.string().describe('ID of the template to delete. Required.'),
      },
      outputSchema: templateDtoShape,
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
      annotations: {
        title: 'Generate a document from a JsonFabrica template',
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
      description:
        'Calls POST /v1/templates/{templateId}/generate. Generates a document from a persisted, saved ' +
        'template referenced by `templateId` — use this (not jsonfabrica_generate_adhoc) when the template ' +
        'is meant to be reused or shared across calls/tenants; use jsonfabrica_generate_adhoc instead when ' +
        'you are still iterating on raw template syntax and don\'t want to persist anything yet. This call is ' +
        'metered/billed like any generation and, unless namespaced, can advance real durable sequences and ' +
        'mutate durable variables referenced by the template body. Set `sequenceNamespace`/`variableNamespace` ' +
        'to isolate those side effects between environments (e.g. test vs. production).',
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
      outputSchema: generationResultShape,
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
      annotations: {
        title: 'Generate a document from a raw template body (no persistence)',
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
      description:
        'Calls POST /v1/templates/generate. Generates a document directly from a raw `body` string ' +
        'without creating a template record — prefer this over jsonfabrica_generate_from_template while ' +
        'still iterating on template syntax; switch to jsonfabrica_create_template once the body is ready ' +
        'to be reused or shared. Goes through the same billing/usage metering as persisted-template ' +
        "generation (not a free bypass). createSeq()/durable sequence side effects still apply; set " +
        '`sequenceNamespace`/`variableNamespace` to e.g. "debug" to avoid colliding with real tenant ' +
        'sequences and variables.',
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
      outputSchema: generationResultShape,
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
