import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Client } from '../client.js';
import { registerHealthTool } from './health.js';
import { registerAuthTools } from './auth.js';
import { registerTemplateTools } from './templates.js';
import { registerSequenceTools } from './sequences.js';
import { registerBatchTools } from './batches.js';
import { registerUsageTools } from './usage.js';
import { registerFunctionWeightTools } from './functionWeights.js';

/**
 * Registers every tool module against the given McpServer instance.
 * Add new tools/*.ts modules here as they're implemented.
 */
export function registerAllTools(server: McpServer, client: Client): void {
  registerHealthTool(server, client);
  registerAuthTools(server, client);
  registerTemplateTools(server, client);
  registerSequenceTools(server, client);
  registerBatchTools(server, client);
  registerUsageTools(server, client);
  registerFunctionWeightTools(server, client);
}
