#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { loadConfig } from './config.js';
import { buildServer } from './server.js';

async function main(): Promise<void> {
  const config = loadConfig(); // warns (does not throw) on a missing API key
  const server = buildServer(config);
  await server.connect(new StdioServerTransport());
}

main().catch((err) => {
  console.error(`[jsonfabrica-mcp-server] fatal: ${(err as Error).message}`);
  process.exit(1);
});
