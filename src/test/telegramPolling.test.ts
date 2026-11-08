import { describe, expect, it, vi } from 'vitest';
import { requestTelegramJson } from '../../supabase/functions/telegram-poll/gateway';

const success = () => new Response(JSON.stringify({ ok: true, result: [{ update_id: 42 }] }));
function clock() {
  let time = 0;
  const sleep = vi.fn(async (ms: number) => { time += ms; });
  return { now: () => time, sleep };
}

describe('Telegram polling gateway recovery', () => {
  it('retries an HTML 502 and returns the update with the unchanged request', async () => {
    const request = vi.fn().mockResolvedValueOnce(new Response('<html>Bad gateway</html>', { status: 502 })).mockResolvedValueOnce(success());
    const timer = clock();
    const result = await requestTelegramJson(request, 10000, timer);
    expect(result.result).toEqual([{ update_id: 42 }]);
    expect(request).toHaveBeenCalledTimes(2);
    expect(timer.sleep).toHaveBeenCalledWith(1000);
  });
  it('retries malformed successful responses instead of throwing a JSON syntax error', async () => {
    const request = vi.fn().mockResolvedValueOnce(new Response('<html>Proxy error</html>')).mockResolvedValueOnce(success());
    expect((await requestTelegramJson(request, 10000, clock())).ok).toBe(true);
    expect(request).toHaveBeenCalledTimes(2);
  });
  it('stops after three transient failures and preserves status and error body', async () => {
    const request = vi.fn(async () => new Response('upstream unavailable', { status: 503 }));
    await expect(requestTelegramJson(request, 10000, clock())).rejects.toMatchObject({ status: 503, details: 'upstream unavailable' });
    expect(request).toHaveBeenCalledTimes(3);
  });
  it('does not retry authentication failures', async () => {
    const request = vi.fn(async () => new Response('unauthorized', { status: 401 }));
    await expect(requestTelegramJson(request, 10000, clock())).rejects.toMatchObject({ status: 401 });
    expect(request).toHaveBeenCalledTimes(1);
  });
  it('does not treat a Telegram ok:false response as an empty success', async () => {
    const request = vi.fn(async () => new Response(JSON.stringify({ ok: false, error_code: 409, description: 'Another poll is active' })));
    await expect(requestTelegramJson(request, 10000, clock())).rejects.toMatchObject({ status: 409 });
    expect(request).toHaveBeenCalledTimes(1);
  });
  it('does not back off beyond the runtime budget', async () => {
    const request = vi.fn(async () => new Response('bad gateway', { status: 502 }));
    const timer = clock();
    await expect(requestTelegramJson(request, 1500, timer)).rejects.toMatchObject({ status: 502 });
    expect(request).toHaveBeenCalledTimes(1);
    expect(timer.sleep).not.toHaveBeenCalled();
  });
  it('retries transient network failures', async () => {
    const request = vi.fn().mockRejectedValueOnce(new TypeError('fetch failed')).mockResolvedValueOnce(success());
    expect((await requestTelegramJson(request, 10000, clock())).ok).toBe(true);
    expect(request).toHaveBeenCalledTimes(2);
  });
});