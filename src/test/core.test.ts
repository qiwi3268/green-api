import { describe, expect, it, vi, afterEach } from 'vitest';
import { normalizePhone } from '../utils/phone';
import { addMessage, forChat, parseNotification } from '../utils/message';
import {
  GreenApiClient,
  validateCredentials,
} from '../services/greenApiClient';
import { credentials, notification } from './fixtures';
afterEach(() => vi.unstubAllGlobals());
describe('phone', () => {
  it.each([
    ['+7 (999) 123-45-67', '79991234567'],
    ['8 999 123 45 67', '79991234567'],
    ['+375 (29) 123-45-67', '375291234567'],
  ])('normalizes %s', (input, output) =>
    expect(normalizePhone(input)).toBe(output),
  );
  it.each([
    '',
    '123',
    '+12345678901',
    '79991234567abc',
    '++79991234567',
    '+37529123456',
  ])('rejects %s', (input) => expect(() => normalizePhone(input)).toThrow());
});
describe('runtime parsing and session store', () => {
  it('parses sender, chat and direction; filters and deduplicates', () => {
    const message = parseNotification(notification)!.message!;
    expect(message).toMatchObject({
      id: 'msg-1',
      chatId: '123',
      sender: '123',
      direction: 'incoming',
      text: 'Привет',
    });
    const stored = addMessage([], message);
    expect(addMessage(stored, message)).toBe(stored);
    expect(forChat(stored, 'other')).toEqual([]);
    expect(forChat(stored, '123')).toEqual([message]);
  });
  it('accepts extended text, empty queue and unsupported types', () => {
    expect(parseNotification(null)).toBeNull();
    expect(
      parseNotification({
        receiptId: 1,
        body: { typeWebhook: 'outgoingAPIMessageReceived' },
      })?.message,
    ).toBeNull();
    expect(
      parseNotification({
        ...notification,
        body: {
          ...notification.body,
          messageData: {
            typeMessage: 'extendedTextMessage',
            extendedTextMessageData: { text: 'https://example.com' },
          },
        },
      })?.message?.text,
    ).toBe('https://example.com');
  });
  it.each([
    {},
    { receiptId: '42', body: {} },
    { ...notification, body: { ...notification.body, senderData: {} } },
    {
      ...notification,
      body: {
        ...notification.body,
        messageData: { typeMessage: 'textMessage' },
      },
    },
  ])('rejects malformed supported data', (value) =>
    expect(() => parseNotification(value)).toThrow(),
  );
});
describe('GREEN-API HTTP contract', () => {
  const client = new GreenApiClient(credentials);
  const signal = new AbortController().signal;
  it('forms all endpoint methods and payloads', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ stateInstance: 'authorized' }))
      .mockResolvedValueOnce(Response.json({ exist: true, chatId: '123' }))
      .mockResolvedValueOnce(Response.json({ idMessage: 'new-id' }))
      .mockResolvedValueOnce(Response.json(null))
      .mockResolvedValueOnce(Response.json({ result: true }));
    vi.stubGlobal('fetch', fetchMock);
    await client.connect(signal);
    expect(await client.checkAccount('79991234567', signal)).toBe('123');
    expect(await client.sendMessage('123', 'Hello', signal)).toBe('new-id');
    expect(await client.receive(signal)).toBeNull();
    await client.acknowledge(42, signal);
    const base = `${credentials.apiUrl}/waInstance${credentials.idInstance}`;
    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
      `${base}/getStateInstance/fake-test-token`,
      `${base}/checkAccount/fake-test-token`,
      `${base}/sendMessage/fake-test-token`,
      `${base}/receiveNotification/fake-test-token?receiveTimeout=30`,
      `${base}/deleteNotification/fake-test-token/42`,
    ]);
    expect(fetchMock.mock.calls.map((call) => call[1].method)).toEqual([
      'GET',
      'POST',
      'POST',
      'GET',
      'DELETE',
    ]);
    expect(JSON.parse(fetchMock.mock.calls[1]![1].body)).toEqual({
      phoneNumber: 79991234567,
    });
    expect(JSON.parse(fetchMock.mock.calls[2]![1].body)).toEqual({
      chatId: '123',
      message: 'Hello',
    });
  });
  it('redacts HTTP and network errors and never retries a send', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response('secret server response', { status: 403 }),
      )
      .mockRejectedValueOnce(new Error('fake-test-token'));
    vi.stubGlobal('fetch', fetchMock);
    await expect(client.sendMessage('123', 'Hello', signal)).rejects.toThrow(
      'Доступ запрещён',
    );
    await expect(client.sendMessage('123', 'Hello', signal)).rejects.toThrow(
      'Нет ответа',
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it('rejects malformed send success, unauthorized state and failed ack', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(Response.json({}))
        .mockResolvedValueOnce(
          Response.json({ stateInstance: 'notAuthorized' }),
        )
        .mockResolvedValueOnce(Response.json({ result: false })),
    );
    await expect(client.sendMessage('123', 'Hello', signal)).rejects.toThrow(
      'формат',
    );
    await expect(client.connect(signal)).rejects.toThrow('QR');
    await expect(client.acknowledge(42, signal)).rejects.toThrow(
      'не подтвердил',
    );
  });
  it.each([
    'https://evil.test',
    'https://api.green-api.com.evil.test',
    'http://3100.api.green-api.com',
    'https://user:pass@3100.api.green-api.com',
    'https://3100.api.green-api.com/path',
  ])('rejects untrusted apiUrl %s', (apiUrl) =>
    expect(() => validateCredentials({ ...credentials, apiUrl })).toThrow(),
  );
});

it('does not accept fields belonging to a different text subtype', () => {
  expect(() =>
    parseNotification({
      ...notification,
      body: {
        ...notification.body,
        messageData: {
          typeMessage: 'textMessage',
          extendedTextMessageData: { text: 'Wrong payload' },
        },
      },
    }),
  ).toThrow();
});
