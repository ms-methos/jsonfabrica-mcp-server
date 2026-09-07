import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Client } from '../client.js';
import { ok, fail } from './respond.js';

export function registerUsageTools(server: McpServer, client: Client): void {
  server.registerTool(
    'jsonfabrica_get_usage',
    {
      title: 'Get JsonFabrica tenant usage',
      annotations: {
        title: 'Get JsonFabrica tenant usage',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
      description: 'Calls GET /v1/usage. Returns `{ tenantId, usageTotal, asOf }` for the configured API key.',
      inputSchema: {},
      outputSchema: {
        tenantId: z.string().describe('Tenant id the usage totals belong to.'),
        usageTotal: z.number().describe('Cumulative metered usage units consumed by this tenant.'),
        asOf: z.string().describe('ISO-8601 timestamp the usage total was computed as of.'),
      },
    },
    async () => {
      try {
        const result = await client.request({ method: 'GET', path: '/v1/usage' });
        return ok(result);
      } catch (err) {
        return fail(err);
      }
    }
  );
}
