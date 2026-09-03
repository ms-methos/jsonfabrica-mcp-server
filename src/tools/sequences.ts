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
        name: z.string(),
        type: z.enum(['number', 'string', 'uuid']),
        start: z.number().optional(),
        step: z.number().optional(),
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
        cursor: z.string().optional(),
        limit: z.number().int().optional(),
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
      inputSchema: { name: z.string() },
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
        name: z.string(),
        currentValue: z.number().optional(),
        step: z.number().optional(),
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
      inputSchema: { name: z.string() },
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
      inputSchema: { name: z.string() },
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
