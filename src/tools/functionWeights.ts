import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Client } from '../client.js';
import { ok, fail } from './respond.js';

const ADMIN_NOTE = 'Requires the configured API key to have role=admin — the gateway returns 403 otherwise.';

export function registerFunctionWeightTools(server: McpServer, client: Client): void {
  server.registerTool(
    'jsonfabrica_list_function_weights',
    {
      title: 'List JsonFabrica generator function weights (admin)',
      description: `Calls GET /v1/admin/function-weights. ${ADMIN_NOTE}`,
      inputSchema: {},
    },
    async () => {
      try {
        return ok(await client.request({ method: 'GET', path: '/v1/admin/function-weights' }));
      } catch (err) {
        return fail(err);
      }
    }
  );

  server.registerTool(
    'jsonfabrica_update_function_weight',
    {
      title: 'Update a JsonFabrica generator function weight (admin)',
      description: `Calls PATCH /v1/admin/function-weights/{functionName}. ${ADMIN_NOTE}`,
      inputSchema: {
        functionName: z.string(),
        weight: z.number(),
      },
    },
    async ({ functionName, weight }) => {
      try {
        return ok(
          await client.request({
            method: 'PATCH',
            path: `/v1/admin/function-weights/${encodeURIComponent(functionName)}`,
            body: { weight },
          })
        );
      } catch (err) {
        return fail(err);
      }
    }
  );
}
