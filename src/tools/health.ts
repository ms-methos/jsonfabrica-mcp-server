import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Client } from '../client.js';
import { describeError } from '../errors.js';

export function registerHealthTool(server: McpServer, client: Client): void {
  server.registerTool(
    'jsonfabrica_health',
    {
      title: 'JsonFabrica health check',
      description:
        'Calls GET /health on the JsonFabrica gateway. No authentication required. ' +
        'Use this to verify JSONFABRICA_API_URL points at a reachable gateway.',
      inputSchema: {},
    },
    async () => {
      try {
        const result = await client.request({ method: 'GET', path: '/health', noAuth: true });
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      } catch (err) {
        return { isError: true, content: [{ type: 'text', text: describeError(err) }] };
      }
    }
  );
}
