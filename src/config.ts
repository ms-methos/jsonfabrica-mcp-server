export interface Config {
  apiKey: string;
  apiUrl: string; // no trailing slash
}

/**
 * Reads configuration from environment variables.
 *
 * A missing JSONFABRICA_API_KEY is a warning, not a fatal error: the server
 * still starts and answers tool-discovery (`tools/list`) requests, and any
 * actual tool call then fails with a clear "check JSONFABRICA_API_KEY"
 * message. This lets clients (and MCP registries' automated checks)
 * introspect the server before auth is configured.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const apiKey = env.JSONFABRICA_API_KEY ?? '';
  if (!apiKey) {
    console.error(
      '[jsonfabrica-mcp-server] warning: JSONFABRICA_API_KEY is not set. ' +
        'Tool discovery works, but every tool call will fail until you set it ' +
        'in your MCP client config env block, e.g. { "env": { "JSONFABRICA_API_KEY": "sk_live_..." } }.'
    );
  }
  const apiUrl = (env.JSONFABRICA_API_URL ?? 'https://api.jsonfabrica.com').replace(/\/$/, '');
  return { apiKey, apiUrl };
}
