import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Client } from '../client.js';
import { ok, fail } from './respond.js';

export function registerAuthTools(server: McpServer, client: Client): void {
  server.registerTool(
    'jsonfabrica_whoami',
    {
      title: 'JsonFabrica whoami',
      annotations: {
        title: 'JsonFabrica whoami',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
      description:
        'Calls GET /v1/whoami on the JsonFabrica gateway using the configured API key. ' +
        'Returns { tenantId, role } for the configured JSONFABRICA_API_KEY.',
      inputSchema: {},
      outputSchema: {
        tenantId: z.string().describe('Tenant id resolved from the configured API key.'),
        role: z.enum(['admin', 'user']).describe('Role associated with the configured API key.'),
      },
    },
    async () => {
      try {
        const result = await client.request({ method: 'GET', path: '/v1/whoami' });
        return ok(result);
      } catch (err) {
        return fail(err);
      }
    }
  );
}
