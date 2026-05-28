// --- Types ---

export interface GoogleApiErrorBody {
  error: {
    code: number;
    message: string;
    status: string;
    errors?: Array<{
      message: string;
      domain: string;
      reason: string;
    }>;
  };
}

export interface FetchOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
}

export interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
}

// --- Error class ---

export class GoogleApiRequestError extends Error {
  readonly status: number;
  readonly body: GoogleApiErrorBody;

  constructor(status: number, body: GoogleApiErrorBody) {
    super(body.error.message);
    this.name = 'GoogleApiRequestError';
    this.status = status;
    this.body = body;
  }
}

// --- Error classifiers ---

export function isRetryableError(error: unknown): boolean {
  if (error instanceof GoogleApiRequestError) {
    return [429, 500, 502, 503].includes(error.status);
  }
  return error instanceof TypeError; // network failure
}

export function isAuthError(error: unknown): boolean {
  return error instanceof GoogleApiRequestError && error.status === 401;
}

export function isPermissionError(error: unknown): boolean {
  return error instanceof GoogleApiRequestError && error.status === 403;
}

// --- Fetch wrapper ---

export async function googleApiFetch<T>(
  accessToken: string,
  url: string,
  options?: FetchOptions,
): Promise<T> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    ...options?.headers,
  };

  let fetchBody: string | undefined;
  if (options?.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    fetchBody = JSON.stringify(options.body);
  }

  const response = await fetch(url, {
    method: options?.method ?? 'GET',
    headers,
    body: fetchBody,
  });

  if (!response.ok) {
    let body: GoogleApiErrorBody;
    try {
      body = (await response.json()) as GoogleApiErrorBody;
    } catch {
      body = {
        error: {
          code: response.status,
          message: response.statusText,
          status: 'UNKNOWN',
        },
      };
    }
    throw new GoogleApiRequestError(response.status, body);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

// --- Retry with exponential backoff ---

export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: RetryOptions,
): Promise<T> {
  const maxRetries = options?.maxRetries ?? 3;
  const baseDelayMs = options?.baseDelayMs ?? 1000;

  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (isAuthError(error) || isPermissionError(error)) {
        throw error;
      }
      if (!isRetryableError(error) || attempt >= maxRetries) {
        throw error;
      }
      const delay = baseDelayMs * Math.pow(2, attempt) + Math.random() * baseDelayMs;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

// --- Column letter helper ---

/** Converts a 1-based column number to a spreadsheet column letter (1→A, 26→Z, 27→AA). */
export function columnLetter(n: number): string {
  let result = '';
  let remaining = n;
  while (remaining > 0) {
    remaining--;
    result = String.fromCharCode(65 + (remaining % 26)) + result;
    remaining = Math.floor(remaining / 26);
  }
  return result;
}
