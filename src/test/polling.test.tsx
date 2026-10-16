import { StrictMode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ApiError, GreenApiClient } from '../services/greenApiClient';
import { pollMessages } from '../services/polling';
import { useMessagePolling } from '../hooks/useMessagePolling';
import { credentials, notification } from './fixtures';
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
it('receives sequentially, processes before ack, and stops on abort', async () => {
  const controller = new AbortController();
  const events: string[] = [];
  const client = {
    receive: vi
      .fn()
      .mockResolvedValueOnce(notification)
      .mockResolvedValue(null),
    acknowledge: vi.fn(async () => {
      events.push('ack');
    }),
  };
  const work = pollMessages(
    client,
    controller.signal,
    () => {
      events.push('message');
    },
    vi.fn(),
  );
  await vi.advanceTimersByTimeAsync(0);
  expect(events).toEqual(['message', 'ack']);
  expect(client.receive).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(100);
  expect(client.receive).toHaveBeenCalledTimes(2);
  controller.abort();
  await work;
  await vi.advanceTimersByTimeAsync(60_000);
  expect(client.receive).toHaveBeenCalledTimes(2);
  expect(vi.getTimerCount()).toBe(0);
});
it('does not delete malformed notifications or retry permanent failures', async () => {
  const client = {
    receive: vi.fn().mockResolvedValue({ ...notification, body: {} }),
    acknowledge: vi.fn(),
  };
  const status = vi.fn();
  const work = pollMessages(
    client,
    new AbortController().signal,
    vi.fn(),
    status,
  );
  await vi.advanceTimersByTimeAsync(0);
  await work;
  expect(client.acknowledge).not.toHaveBeenCalled();
  expect(status).toHaveBeenLastCalledWith(
    expect.objectContaining({ state: 'stopped' }),
  );
});
it('preserves notification if message processing fails', async () => {
  const client = {
    receive: vi.fn().mockResolvedValue(notification),
    acknowledge: vi.fn(),
  };
  const work = pollMessages(
    client,
    new AbortController().signal,
    () => {
      throw new Error('storage failed');
    },
    vi.fn(),
  );
  await vi.advanceTimersByTimeAsync(0);
  await work;
  expect(client.acknowledge).not.toHaveBeenCalled();
});
it('uses bounded exponential backoff and cancels the pending delay', async () => {
  const controller = new AbortController();
  const client = {
    receive: vi.fn().mockRejectedValue(new ApiError('Network', true)),
    acknowledge: vi.fn(),
  };
  const status = vi.fn();
  const work = pollMessages(client, controller.signal, vi.fn(), status);
  await vi.advanceTimersByTimeAsync(0);
  await vi.advanceTimersByTimeAsync(999);
  expect(client.receive).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(1);
  expect(client.receive).toHaveBeenCalledTimes(2);
  await vi.advanceTimersByTimeAsync(2000 + 4000 + 8000 + 16000);
  expect(status).toHaveBeenLastCalledWith(
    expect.objectContaining({ detail: expect.stringContaining('30 с.') }),
  );
  controller.abort();
  await work;
  expect(vi.getTimerCount()).toBe(0);
});
it('StrictMode starts one fetch and unmount aborts its signal', async () => {
  let requestSignal: AbortSignal | undefined;
  const fetchMock = vi.fn((_url: string, init: RequestInit) => {
    requestSignal = init.signal as AbortSignal;
    return new Promise<Response>(() => {});
  });
  vi.stubGlobal('fetch', fetchMock);
  const client = new GreenApiClient(credentials);
  const onMessage = vi.fn();
  const hook = renderHook(() => useMessagePolling(client, onMessage), {
    wrapper: StrictMode,
  });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
  expect(fetchMock).toHaveBeenCalledTimes(1);
  hook.unmount();
  expect(requestSignal?.aborted).toBe(true);
});

it('waits for acknowledgement before receiving the next event', async () => {
  const controller = new AbortController();
  let finishAck: (() => void) | undefined;
  const client = {
    receive: vi.fn().mockResolvedValue(notification),
    acknowledge: vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finishAck = resolve;
        }),
    ),
  };
  const work = pollMessages(client, controller.signal, vi.fn(), vi.fn());
  await vi.advanceTimersByTimeAsync(0);
  await vi.advanceTimersByTimeAsync(10_000);
  expect(client.receive).toHaveBeenCalledTimes(1);
  expect(client.acknowledge).toHaveBeenCalledTimes(1);
  controller.abort();
  finishAck!();
  await work;
  expect(client.receive).toHaveBeenCalledTimes(1);
});
