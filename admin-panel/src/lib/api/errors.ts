import axios from 'axios';

/**
 * Turns any thrown value into a message the user can act on.
 *
 * The design system requires an error to say what happened and what to do next,
 * and the backend already speaks Persian: `HttpException` carries a plain
 * string, while the global `ValidationPipe` returns an array of class-validator
 * messages. Both shapes are unwrapped here so pages can pass one fallback for
 * "the network is down or something unexpected happened".
 */
export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    // No `response` means the request never reached Nest: DNS, CORS, timeout.
    if (!error.response) return fallback;

    const data = error.response.data as { message?: unknown } | undefined;
    const message = data?.message;

    if (typeof message === 'string' && message.trim()) return message;

    if (Array.isArray(message)) {
      const first = message.find(
        (entry): entry is string => typeof entry === 'string' && entry.trim().length > 0,
      );
      if (first) return first;
    }
  }

  return fallback;
}

/** True when the failure is a lost/absent connection rather than an API answer. */
export function isNetworkError(error: unknown): boolean {
  return axios.isAxiosError(error) && !error.response;
}
