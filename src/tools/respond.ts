import { describeError } from '../errors.js';

/**
 * Shared response-building helpers for MCP tool handlers.
 *
 * `client.request()` returns `undefined` for responses with no body (e.g. a
 * real HTTP 204 No Content from DELETE endpoints). `JSON.stringify(undefined)`
 * evaluates to the JS value `undefined`, not a string, which produces a
 * `content[0].text` that is not a string and violates the MCP `TextContent`
 * schema — this makes spec-compliant MCP clients (including the SDK's own
 * `Client`) reject the response with `McpError -32602 "Invalid tools/call
 * result"`. `ok()` guards against that by substituting a fixed human-readable
 * string whenever the underlying result is `undefined`.
 *
 * Once a tool declares `outputSchema`, the SDK (`@modelcontextprotocol/sdk`,
 * see `validateToolOutput` in `server/mcp.js`) additionally requires every
 * successful response to carry a `structuredContent` field that validates
 * against it — a text-only response is rejected with "Invalid structured
 * content". `ok()` attaches `structuredContent` whenever `result` is
 * defined. `outputSchema` (like `inputSchema`) must be a plain object shape,
 * so a bare-array gateway response (e.g. `list_function_weights`) is wrapped
 * as `{ items: result }` to match its `{ items: [...] }` outputSchema; other
 * results are already response objects and are passed through as-is.
 * Tools with no meaningful response body (e.g. `jsonfabrica_delete_sequence`,
 * whose gateway call returns a 204) must be registered with NO
 * `outputSchema` at all, since `ok(undefined)` never attaches
 * `structuredContent` and the SDK requires `structuredContent` for any tool
 * that *does* declare an `outputSchema`.
 */
export function ok(result: unknown) {
  if (result === undefined) {
    return { content: [{ type: 'text' as const, text: 'OK (no content)' }] };
  }
  const text = JSON.stringify(result, null, 2);
  const structuredContent = (Array.isArray(result) ? { items: result } : result) as Record<string, unknown>;
  return { content: [{ type: 'text' as const, text }], structuredContent };
}

export function fail(err: unknown) {
  return { isError: true, content: [{ type: 'text' as const, text: describeError(err) }] };
}
