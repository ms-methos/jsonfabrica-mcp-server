import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Client } from '../client.js';
import { ok, fail } from './respond.js';

export function registerHealthTool(server: McpServer, client: Client): void {
  server.registerTool(
    'jsonfabrica_health',
    {
      title: 'JsonFabrica health check',
      annotations: {
        title: 'JsonFabrica health check',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
      description:
        'Calls GET /health on the JsonFabrica gateway. No authentication required. ' +
        'Use this to verify JSONFABRICA_API_URL points at a reachable gateway.',
      inputSchema: {},
      outputSchema: {
        status: z.string().describe('Liveness indicator, e.g. "ok".'),
        service: z.string().optional().describe('Name of the responding service, e.g. "svc-gateway".'),
      },
    },
    async () => {
      try {
        const result = await client.request({ method: 'GET', path: '/health', noAuth: true });
        return ok(result);
      } catch (err) {
        return fail(err);
      }
    }
  );
}
