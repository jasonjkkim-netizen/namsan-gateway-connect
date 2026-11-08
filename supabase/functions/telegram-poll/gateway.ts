export class TelegramGatewayError extends Error {
  constructor(public status: number, public details: string) {
    super(`Telegram API failed [${status}]: ${details}`);
  }
}

interface TelegramResponse {
  ok: boolean;
  result?: unknown;
  description?: string;
  error_code?: number;
}

// Retry only transient transport/server failures; never extend the polling deadline.
export async function requestTelegramJson(
  request: (remainingMs: number) => Promise<Response>,
  deadline: number,
  options: {
    now?: () => number;
    sleep?: (ms: number) => Promise<void>;
    onFailure?: (error: TelegramGatewayError) => void;
  } = {},
): Promise<TelegramResponse> {
  const now = options.now ?? Date.now;
  const sleep = options.sleep ?? ((ms) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  let lastError = new TelegramGatewayError(504, 'Polling deadline reached');
  for (let attempt = 0; attempt < 3; attempt++) {
    const remaining = deadline - now();
    if (remaining < 1000) throw lastError;
    let retryable = true;
    try {
      const response = await request(remaining);
      const body = await response.text();
      if (!response.ok) {
        lastError = new TelegramGatewayError(response.status, body);
        retryable = response.status >= 500 && response.status <= 599;
      } else {
        let data: TelegramResponse;
        try {
          data = JSON.parse(body);
        } catch {
          throw new TelegramGatewayError(502, 'Telegram returned a non-JSON response');
        }
        if (!data || typeof data !== 'object' || typeof data.ok !== 'boolean') {
          throw new TelegramGatewayError(502, 'Invalid Telegram response');
        }
        if (data.ok) return data;
        lastError = new TelegramGatewayError(data.error_code ?? 502, data.description ?? body);
        retryable = lastError.status >= 500 && lastError.status <= 599;
      }
    } catch (error) {
      lastError = error instanceof TelegramGatewayError
        ? error
        : new TelegramGatewayError(502, error instanceof Error ? error.message : 'Telegram connection failed');
    }
    options.onFailure?.(lastError);
    const delay = 1000 * 2 ** attempt;
    if (!retryable || attempt === 2 || deadline - now() < delay + 1000) throw lastError;
    await sleep(delay);
  }
  throw lastError;
}