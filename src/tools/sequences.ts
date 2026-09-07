import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Client } from '../client.js';
import { ok, fail } from './respond.js';

export function registerSequenceTools(server: McpServer, client: Client): void {
  server.registerTool(
    'jsonfabrica_create_sequence',
    {
      title: 'Create a JsonFabrica sequence',
      description:
        'Calls POST /v1/sequences. Creates a durable named sequence (number/string/uuid), ' +
        'referenced from template bodies via createSeq()/getSeq()-style functions.',
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
              '"uuid" ignores `start`/`step` and returns a freshly generated UUID on each bump. Required.'
          ),
        start: z
          .number()
          .optional()
          .describe(
            'Initial value of `currentValue` for "number"/"string" sequences (ignored for "uuid"). Marked ' +
              'optional in this schema, but the server has no fallback default — omitting it causes the ' +
              'gateway to reject the request with a 400 validation error, so it should be supplied for ' +
              '"number"/"string" sequences.'
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
      description: 'Calls GET /v1/sequences. Returns a page of sequences (`{ items, nextCursor }`).',
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
            'Maximum number of sequences to return in this page. Optional; defaults to 20 when omitted, ' +
              'capped at a server-enforced maximum of 100.'
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
      description: 'Calls GET /v1/sequences/{name}. Returns the sequence record.',
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
      description: 'Calls PATCH /v1/sequences/{name}. Only the provided fields (currentValue, step) are changed.',
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
      description: 'Calls DELETE /v1/sequences/{name}. Returns no content on success.',
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
      description: 'Calls POST /v1/sequences/{name}/bump. Advances the sequence by its step and returns the updated record.',
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
