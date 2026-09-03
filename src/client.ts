import type { Config } from './config.js';
import { ApiError } from './errors.js';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface RequestOptions {
  method: HttpMethod;
  path: string; // e.g. '/v1/templates/tpl_123'
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  /** Set true for endpoints that don't require auth (e.g. /health). */
  noAuth?: boolean;
}

export interface Client {
  request<T = unknown>(opts: RequestOptions): Promise<T>;
}

function buildUrl(apiUrl: string, path: string, query?: RequestOptions['query']): string {
  const url = new URL(apiUrl + path);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url.toString();
}

/**
 * Creates a thin fetch-based client for the JsonFabrica gateway API.
 * Every tool goes through this — it's the only place that knows about
 * fetch, the base URL, and the Authorization header.
 */
export function createClient(config: Config, fetchImpl: typeof fetch = fetch): Client {
  return {
    async request<T = unknown>(opts: RequestOptions): Promise<T> {
      const url = buildUrl(config.apiUrl, opts.path, opts.query);
      const headers: Record<string, string> = {
        'content-type': 'application/json',
      };
      if (!opts.noAuth) {
        headers['authorization'] = `Bearer ${config.apiKey}`;
      }

      let response: Response;
      try {
        response = await fetchImpl(url, {
          method: opts.method,
          headers,
          body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
        });
      } catch (err) {
        throw new ApiError(
          'UPSTREAM_UNREACHABLE',
          `Could not reach JsonFabrica gateway at ${config.apiUrl}: ${(err as Error).message}`
        );
      }

      if (response.status === 204) {
        return undefined as T;
      }

      const rawText = await response.text();
      let parsed: unknown;
      try {
        parsed = rawText ? JSON.parse(rawText) : undefined;
      } catch {
        parsed = undefined;
      }

      if (!response.ok) {
        const envelope = parsed as { error?: { code?: string; message?: string; details?: unknown } } | undefined;
        const code = envelope?.error?.code ?? `HTTP_${response.status}`;
        const message = envelope?.error?.message ?? (rawText || response.statusText);
        throw new ApiError(code, message, envelope?.error?.details, response.status);
      }

      return parsed as T;
    },
  };
}
