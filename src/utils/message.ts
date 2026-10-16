import { invalidResponse, nonempty, record } from '../services/greenApiClient';
import type { Message } from '../types/chat';
export function parseNotification(
  value: unknown,
): { receiptId: number; message: Message | null } | null {
  if (value === null) return null;
  if (
    !record(value) ||
    typeof value.receiptId !== 'number' ||
    !Number.isSafeInteger(value.receiptId) ||
    value.receiptId < 0 ||
    !record(value.body) ||
    !nonempty(value.body.typeWebhook)
  )
    invalidResponse();
  const { body, receiptId } = value;
  // Explicit discard policy: well-formed envelopes of unsupported event types are acknowledged.
  if (body.typeWebhook !== 'incomingMessageReceived')
    return { receiptId, message: null };
  if (!record(body.messageData) || !nonempty(body.messageData.typeMessage))
    invalidResponse();
  const data = body.messageData;
  if (
    data.typeMessage !== 'textMessage' &&
    data.typeMessage !== 'extendedTextMessage'
  )
    return { receiptId, message: null };
  const text =
    data.typeMessage === 'textMessage' && record(data.textMessageData)
      ? data.textMessageData.textMessage
      : data.typeMessage === 'extendedTextMessage' &&
          record(data.extendedTextMessageData)
        ? data.extendedTextMessageData.text
        : undefined;
  if (
    typeof text !== 'string' ||
    !nonempty(body.idMessage) ||
    !record(body.senderData) ||
    !nonempty(body.senderData.chatId) ||
    !nonempty(body.senderData.sender) ||
    typeof body.timestamp !== 'number' ||
    !Number.isFinite(body.timestamp) ||
    body.timestamp < 0 ||
    body.timestamp > 8.64e12
  )
    invalidResponse();
  return {
    receiptId,
    message: {
      id: body.idMessage,
      chatId: body.senderData.chatId,
      sender: body.senderData.sender,
      text,
      timestamp: body.timestamp * 1000,
      direction: 'incoming',
    },
  };
}
export function addMessage(messages: Message[], message: Message): Message[] {
  return messages.some(
    (item) => item.id === message.id && item.chatId === message.chatId,
  )
    ? messages
    : [...messages, message];
}
export function forChat(messages: Message[], chatId: string): Message[] {
  return messages.filter((message) => message.chatId === chatId);
}
