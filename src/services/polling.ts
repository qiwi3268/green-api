import { ApiError, safeError, type GreenApiClient } from './greenApiClient';
import { parseNotification } from '../utils/message';
import type { Message } from '../types/chat';
export interface PollStatus {
  state: 'receiving' | 'retrying' | 'stopped';
  detail: string;
}
export function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve();
      return;
    }
    const finish = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', finish);
      resolve();
    };
    const timer = setTimeout(finish, ms);
    signal.addEventListener('abort', finish, { once: true });
  });
}
export async function pollMessages(
  client: Pick<GreenApiClient, 'receive' | 'acknowledge'>,
  signal: AbortSignal,
  onMessage: (message: Message) => void,
  onStatus: (status: PollStatus) => void,
): Promise<void> {
  let failures = 0;
  // Deferring the first request lets StrictMode's setup/cleanup probe cancel before fetching.
  await delay(0, signal);
  while (!signal.aborted) {
    try {
      const value = await client.receive(signal);
      if (signal.aborted) return;
      const notification = parseNotification(value);
      if (notification) {
        if (notification.message) onMessage(notification.message);
        if (signal.aborted) return;
        await client.acknowledge(notification.receiptId, signal);
      }
      if (signal.aborted) return;
      failures = 0;
      onStatus({ state: 'receiving', detail: 'Получение сообщений активно' });
      await delay(notification ? 100 : 1000, signal);
    } catch (error) {
      if (signal.aborted) return;
      if (!(error instanceof ApiError) || !error.retryable) {
        onStatus({
          state: 'stopped',
          detail:
            error instanceof ApiError
              ? safeError(error)
              : 'Обработка уведомления остановлена. Оно не удалено из очереди.',
        });
        return;
      }
      const wait = Math.min(1000 * 2 ** Math.min(failures++, 5), 30_000);
      onStatus({
        state: 'retrying',
        detail: `${safeError(error)} Повтор через ${wait / 1000} с.`,
      });
      await delay(wait, signal);
    }
  }
}
