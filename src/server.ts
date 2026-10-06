import { createRequire } from 'node:module';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Config } from './config.js';
import { createClient } from './client.js';
import { registerAllTools } from './tools/index.js';

export const SERVER_NAME = 'jsonfabrica-mcp-server';

/**
 * Version reported in MCP `serverInfo`, read from package.json at startup so
 * it can't drift from the published package version. Resolved relative to
 * the compiled `dist/server.js`; package.json sits one level up in the repo,
 * the npm tarball, and the Docker image alike.
 */
export const SERVER_VERSION: string = (createRequire(import.meta.url)('../package.json') as { version: string }).version;

/**
 * Builds the McpServer instance, wiring the API client and every tool
 * module. Does not connect a transport — that's the caller's job.
 */
export function buildServer(config: Config): McpServer {
  const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });
  const client = createClient(config);
  registerAllTools(server, client);
  return server;
}
