import { useEffect, useState } from 'react';
import type { GreenApiClient } from '../services/greenApiClient';
import { pollMessages, type PollStatus } from '../services/polling';
import type { Message } from '../types/chat';
export function useMessagePolling(
  client: GreenApiClient,
  onMessage: (message: Message) => void,
) {
  const [status, setStatus] = useState<PollStatus>({
    state: 'receiving',
    detail: 'Получение сообщений активно',
  });
  const [generation, setGeneration] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    void pollMessages(client, controller.signal, onMessage, setStatus);
    return () => controller.abort();
  }, [client, onMessage, generation]);
  return {
    status,
    retry: () => {
      setStatus({ state: 'receiving', detail: 'Подключение к очереди…' });
      setGeneration((value) => value + 1);
    },
  };
}
