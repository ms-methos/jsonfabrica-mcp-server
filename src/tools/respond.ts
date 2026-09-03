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
 */
export function ok(result: unknown) {
  const text = result === undefined ? 'OK (no content)' : JSON.stringify(result, null, 2);
  return { content: [{ type: 'text' as const, text }] };
}

export function fail(err: unknown) {
  return { isError: true, content: [{ type: 'text' as const, text: describeError(err) }] };
}
