import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Client } from '../client.js';
import { ok, fail } from './respond.js';

const ADMIN_NOTE = 'Requires the configured API key to have role=admin — the gateway returns 403 otherwise.';

// Mirrors FunctionWeightDto in api-docs/openapi-external-gateway.yaml.
const functionWeightDtoShape = {
  functionName: z.string().describe('Name of the generator function, e.g. "getRandomFullName".'),
  weight: z.number().describe('Usage units consumed each time the function is invoked during generation.'),
  updatedAt: z.string().describe('ISO-8601 timestamp of the last weight change.'),
  updatedBy: z.string().optional().nullable().describe('Tenant id that last changed the weight, if any.'),
};

export function registerFunctionWeightTools(server: McpServer, client: Client): void {
  server.registerTool(
    'jsonfabrica_list_function_weights',
    {
      title: 'List JsonFabrica generator function weights (admin)',
      annotations: {
        title: 'List JsonFabrica generator function weights (admin)',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
      description: `Calls GET /v1/admin/function-weights. ${ADMIN_NOTE}`,
      inputSchema: {},
      outputSchema: {
        items: z
          .array(z.object(functionWeightDtoShape))
          .describe(
            'All configured function weights. The gateway itself returns a bare JSON array; it is wrapped ' +
              'under `items` here for `structuredContent` (the raw array is still what `content[0].text` shows).'
          ),
      },
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
      annotations: {
        title: 'Update a JsonFabrica generator function weight (admin)',
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
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
              'Platform defaults are 10 for most generator functions, except createSeq, getSeq, and getContext, ' +
              'which default to 1000. Must be a positive finite number ' +
              '(<= 0, NaN, or Infinity are rejected with a 400 validation error). Required — this call always ' +
              'replaces the current weight, there is no partial/omitted-field behaviour.'
          ),
      },
      outputSchema: functionWeightDtoShape,
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
