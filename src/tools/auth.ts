import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Client } from '../client.js';
import { describeError } from '../errors.js';

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
    },
    async () => {
      try {
        const result = await client.request({ method: 'GET', path: '/v1/whoami' });
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      } catch (err) {
        return { isError: true, content: [{ type: 'text', text: describeError(err) }] };
      }
    }
  );
}
