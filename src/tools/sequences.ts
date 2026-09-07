import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Client } from '../client.js';
import { ok, fail } from './respond.js';

export function registerSequenceTools(server: McpServer, client: Client): void {
  server.registerTool(
    'jsonfabrica_create_sequence',
    {
      title: 'Create a JsonFabrica sequence',
      annotations: {
        title: 'Create a JsonFabrica sequence',
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
      description:
        'Calls POST /v1/sequences. Creates a durable named sequence (number/string/uuid), ' +
        'referenced from template bodies via createSeq()/getSeq()-style functions. Fails with a 409-style ' +
        'conflict error if a sequence with this `name` already exists for the tenant — use ' +
        'jsonfabrica_update_sequence to change an existing one\'s `currentValue`/`step` instead of retrying ' +
        'create with the same name.',
      inputSchema: {
        name: z
          .string()
          .describe(
            'Unique identifier for the sequence within the tenant, referenced from template bodies via ' +
              'createSeq("name")/getSeq("name") placeholders. Required; creation fails if a sequence with this ' +
              'name already exists.'
          ),
        type: z
          .enum(['number', 'string', 'uuid'])
          .describe(
            'Value kind the sequence produces on each bump: "number" increments `currentValue` by `step` and ' +
              'returns a numeric value; "string" behaves like "number" but the returned value is stringified; ' +
              '"uuid" does not use `start`/`step` to derive values (but `start` must still be provided — see ' +
              'its description); each bump returns a fresh UUID. Required.'
          ),
        start: z
          .number()
          .optional()
          .describe(
            'Initial value of `currentValue` for "number"/"string" sequences. Marked optional in this schema, ' +
              'but the gateway validates it as a required finite number for every sequence type — omitting ' +
              'it always causes a 400 validation error, even for type "uuid". For "uuid" sequences the value ' +
              'is stored but not used to derive the generated UUIDs.'
          ),
        step: z
          .number()
          .optional()
          .describe(
            'Amount `currentValue` is incremented by on each bump, for "number"/"string" sequences (ignored ' +
              'for "uuid"). Optional; defaults to 1 when omitted. May be negative to count down.'
          ),
      },
    },
    async (args) => {
      try {
        return ok(await client.request({ method: 'POST', path: '/v1/sequences', body: args }));
      } catch (err) {
        return fail(err);
      }
    }
  );

  server.registerTool(
    'jsonfabrica_list_sequences',
    {
      title: 'List JsonFabrica sequences',
      annotations: {
        title: 'List JsonFabrica sequences',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
      description:
        'Calls GET /v1/sequences. Returns a page of sequences (`{ items, nextCursor }`). Use this to ' +
        'discover sequence names when you don\'t already know one; if you know the exact `name`, call ' +
        'jsonfabrica_get_sequence directly instead. Read-only, no side effects.',
      inputSchema: {
        cursor: z
          .string()
          .optional()
          .describe(
            'Opaque pagination cursor from a previous response\'s `nextCursor`. Optional; omit to fetch the ' +
              'first page. Not a page number or offset you construct yourself.'
          ),
        limit: z
          .number()
          .int()
          .optional()
          .describe(
            'Maximum number of sequences to return in this page. Optional; defaults to 20 when omitted. ' +
              'Values <= 0 or > 100 are not clamped — the request is rejected with a 400 validation error.'
          ),
      },
    },
    async (args) => {
      try {
        return ok(await client.request({ method: 'GET', path: '/v1/sequences', query: args }));
      } catch (err) {
        return fail(err);
      }
    }
  );

  server.registerTool(
    'jsonfabrica_get_sequence',
    {
      title: 'Get a JsonFabrica sequence',
      annotations: {
        title: 'Get a JsonFabrica sequence',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
      description:
        'Calls GET /v1/sequences/{name}. Returns the sequence record for a known `name`; use ' +
        'jsonfabrica_list_sequences instead if you need to discover names. Read-only — does not advance the ' +
        'sequence (use jsonfabrica_bump_sequence for that).',
      inputSchema: {
        name: z.string().describe('Exact name of the sequence to fetch, as given at creation. Required.'),
      },
    },
    async ({ name }) => {
      try {
        return ok(await client.request({ method: 'GET', path: `/v1/sequences/${encodeURIComponent(name)}` }));
      } catch (err) {
        return fail(err);
      }
    }
  );

  server.registerTool(
    'jsonfabrica_update_sequence',
    {
      title: 'Update a JsonFabrica sequence',
      annotations: {
        title: 'Update a JsonFabrica sequence',
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
      description:
        'Calls PATCH /v1/sequences/{name}. Only the provided fields (currentValue, step) are changed; fields ' +
        'you omit are left as-is. Use this when you need to set an explicit `currentValue` (e.g. resetting a ' +
        'counter) or change the `step` amount — use jsonfabrica_bump_sequence instead when you just want to ' +
        'advance the sequence by its existing configured step. This overwrites the sequence\'s stored state ' +
        'in place immediately; there is no undo.',
      inputSchema: {
        name: z.string().describe('Exact name of the sequence to update. Required.'),
        currentValue: z
          .number()
          .optional()
          .describe(
            'Resets the sequence\'s current counter value to this number, without changing `step`. Optional; ' +
              'if omitted, the current value is left unchanged (unless `step` is also provided, in which case ' +
              'only `step` changes).'
          ),
        step: z
          .number()
          .optional()
          .describe(
            'Changes the increment applied by future jsonfabrica_bump_sequence calls; must be a non-zero ' +
              'finite number (negative allowed, to count down). Optional; if omitted, the existing step is ' +
              'left unchanged.'
          ),
      },
    },
    async ({ name, ...body }) => {
      try {
        return ok(await client.request({ method: 'PATCH', path: `/v1/sequences/${encodeURIComponent(name)}`, body }));
      } catch (err) {
        return fail(err);
      }
    }
  );

  server.registerTool(
    'jsonfabrica_delete_sequence',
    {
      title: 'Delete a JsonFabrica sequence',
      annotations: {
        title: 'Delete a JsonFabrica sequence',
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
      description:
        'Calls DELETE /v1/sequences/{name}. This is a hard, permanent delete — unlike ' +
        'jsonfabrica_delete_template\'s soft-delete/archive behavior, the sequence record is removed entirely ' +
        'and cannot be recovered; there is no `status: "archived"` equivalent for sequences. Returns no ' +
        'content on success. Any template body still calling createSeq()/getSeq() with this `name` afterwards ' +
        'will no longer see the deleted history/state.',
      inputSchema: {
        name: z.string().describe('Exact name of the sequence to delete. Required.'),
      },
    },
    async ({ name }) => {
      try {
        return ok(await client.request({ method: 'DELETE', path: `/v1/sequences/${encodeURIComponent(name)}` }));
      } catch (err) {
        return fail(err);
      }
    }
  );

  server.registerTool(
    'jsonfabrica_bump_sequence',
    {
      title: 'Bump a JsonFabrica sequence',
      annotations: {
        title: 'Bump a JsonFabrica sequence',
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
      description:
        'Calls POST /v1/sequences/{name}/bump. Atomically advances the sequence by its configured `step` ' +
        '(a permanent, irreversible change to the stored `currentValue`) and returns the updated record — ' +
        'this is the same advance a template\'s createSeq()/getSeq() calls trigger during generation. Use ' +
        'jsonfabrica_update_sequence instead if you need to set an explicit `currentValue`/`step` rather than ' +
        'advancing by the existing step.',
      inputSchema: {
        name: z.string().describe('Exact name of the sequence to bump (advance by its configured step). Required.'),
      },
    },
    async ({ name }) => {
      try {
        return ok(await client.request({ method: 'POST', path: `/v1/sequences/${encodeURIComponent(name)}/bump` }));
      } catch (err) {
        return fail(err);
      }
    }
  );
}
