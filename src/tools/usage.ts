import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Client } from '../client.js';
import { describeError } from '../errors.js';

export function registerUsageTools(server: McpServer, client: Client): void {
  server.registerTool(
    'jsonfabrica_get_usage',
    {
      title: 'Get JsonFabrica tenant usage',
      description: 'Calls GET /v1/usage. Returns `{ tenantId, usageTotal, asOf }` for the configured API key.',
      inputSchema: {},
    },
    async () => {
      try {
        const result = await client.request({ method: 'GET', path: '/v1/usage' });
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      } catch (err) {
        return { isError: true, content: [{ type: 'text', text: describeError(err) }] };
      }
    }
  );
}
