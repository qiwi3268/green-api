import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ApiError,
  safeError,
  type GreenApiClient,
} from '../services/greenApiClient';
import type { Chat, Message } from '../types/chat';
import { addMessage, forChat } from '../utils/message';
import { normalizePhone } from '../utils/phone';
import { useMessagePolling } from './useMessagePolling';
export function useChat(client: GreenApiClient) {
  const [chat, setChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [opening, setOpening] = useState(false);
  const [sending, setSending] = useState(false);
  const [chatError, setChatError] = useState('');
  const [sendError, setSendError] = useState('');
  const requests = useRef(new Set<AbortController>());
  const openLock = useRef(false);
  const sendLock = useRef(false);
  const cache = useRef(new Map<string, string>());
  const accept = useCallback(
    (message: Message) =>
      setMessages((previous) => addMessage(previous, message)),
    [],
  );
  const polling = useMessagePolling(client, accept);
  useEffect(() => {
    const active = requests.current;
    return () => {
      active.forEach((controller) => controller.abort());
      active.clear();
    };
  }, []);
  async function openChat(input: string) {
    if (openLock.current || sendLock.current) return;
    let phone: string;
    try {
      phone = normalizePhone(input);
    } catch (error) {
      setChatError(error instanceof Error ? error.message : 'Проверьте номер.');
      return;
    }
    const controller = new AbortController();
    requests.current.add(controller);
    openLock.current = true;
    setOpening(true);
    setChatError('');
    try {
      const id =
        cache.current.get(phone) ??
        (await client.checkAccount(phone, controller.signal));
      if (!controller.signal.aborted) {
        cache.current.set(phone, id);
        setChat({ id, phone });
        setSendError('');
      }
    } catch (error) {
      if (!controller.signal.aborted) setChatError(safeError(error));
    } finally {
      requests.current.delete(controller);
      openLock.current = false;
      if (!controller.signal.aborted) setOpening(false);
    }
  }
  async function send(text: string): Promise<boolean> {
    if (!chat || !text.trim() || sendLock.current || openLock.current)
      return false;
    const controller = new AbortController();
    requests.current.add(controller);
    sendLock.current = true;
    setSending(true);
    setSendError('');
    try {
      const id = await client.sendMessage(chat.id, text, controller.signal);
      if (controller.signal.aborted) return false;
      accept({
        id,
        chatId: chat.id,
        sender: 'self',
        text,
        timestamp: Date.now(),
        direction: 'outgoing',
      });
      return true;
    } catch (error) {
      if (!controller.signal.aborted)
        setSendError(
          `${safeError(error)}${error instanceof ApiError && error.retryable ? ' Перед повтором проверьте MAX: сообщение могло быть принято. Автоповтора нет.' : ''}`,
        );
      return false;
    } finally {
      requests.current.delete(controller);
      sendLock.current = false;
      if (!controller.signal.aborted) setSending(false);
    }
  }
  return {
    chat,
    messages: chat ? forChat(messages, chat.id) : [],
    opening,
    sending,
    chatError,
    sendError,
    openChat,
    send,
    polling,
  };
}
