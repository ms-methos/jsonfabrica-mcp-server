/**
 * ApiError represents a failure talking to the JsonFabrica gateway API,
 * whether that's a network failure or a non-2xx HTTP response.
 */
export class ApiError extends Error {
  public readonly code: string;
  public readonly details?: unknown;
  public readonly httpStatus?: number;

  constructor(code: string, message: string, details?: unknown, httpStatus?: number) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.details = details;
    this.httpStatus = httpStatus;
  }
}

/**
 * Produces a human-readable message for a caught error, adding friendlier
 * text for well-known error codes/statuses per the design doc's error
 * handling section. Never includes the API key.
 */
export function describeError(err: unknown): string {
  const e = err instanceof ApiError ? err : new ApiError('UNKNOWN', errorMessage(err));

  if (e.httpStatus === 401 || e.code === 'UNAUTHORIZED') {
    return 'Invalid or missing API key — check JSONFABRICA_API_KEY.';
  }
  if (e.httpStatus === 403 || e.code === 'FORBIDDEN') {
    return 'This API key does not have admin role.';
  }
  if (e.httpStatus === 402) {
    const details = e.details as { blockReason?: string } | undefined;
    if (details?.blockReason) {
      return `Payment required: ${details.blockReason}`;
    }
  }
  return `JsonFabrica API error [${e.code}] (HTTP ${e.httpStatus ?? '?'}): ${e.message}`;
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}
