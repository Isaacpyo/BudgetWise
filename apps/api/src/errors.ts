export class AppError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const notFound = (what: string) => new AppError(404, 'NOT_FOUND', `${what} not found`);
export const unauthorized = (message = 'Sign in required') =>
  new AppError(401, 'UNAUTHORIZED', message);
export const badRequest = (message: string, details?: unknown) =>
  new AppError(400, 'BAD_REQUEST', message, details);

/**
 * Errors from the Plaid client are axios errors carrying Plaid's error body.
 * Surface Plaid's user-facing message when there is one, never the raw response.
 */
export function fromPlaidError(err: unknown): AppError | null {
  const data = (err as { response?: { data?: Record<string, unknown> } })?.response?.data;
  if (!data || typeof data.error_code !== 'string') return null;
  const display = typeof data.display_message === 'string' ? data.display_message : null;
  const message =
    display ??
    (typeof data.error_message === 'string' ? data.error_message : 'Bank provider error');
  return new AppError(502, `PLAID_${data.error_code}`, message);
}
