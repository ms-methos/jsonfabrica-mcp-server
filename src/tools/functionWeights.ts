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
        functionName: z
          .string()
          .describe(
            'Exact name of the generator function to reweight, e.g. "getRandomFullName" or "getRandomNumber" ' +
              '(must match a name already returned by jsonfabrica_list_function_weights — unknown names return 404). Required.'
          ),
        weight: z
          .number()
          .describe(
            'New billing weight for this function: the number of usage units consumed each time the function ' +
              'is invoked during generation (metered to Stripe as "weight-units-consumed", additive across a ' +
              "document's generated calls — it is not a percentage or ratio relative to other functions). " +
              'Platform defaults are 10 for most generator functions. Must be a positive finite number ' +
              '(<= 0, NaN, or Infinity are rejected with a 400 validation error). Required — this call always ' +
              'replaces the current weight, there is no partial/omitted-field behaviour.'
          ),
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
