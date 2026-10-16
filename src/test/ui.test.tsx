import { StrictMode } from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import App from '../app/App';
import MessageInput from '../components/MessageInput';
import { notification } from './fixtures';
afterEach(() => vi.unstubAllGlobals());
it('retains failed draft, supports Shift+Enter and clears only on success', async () => {
  const send = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
  const user = userEvent.setup();
  render(<MessageInput send={send} sending={false} disabled={false} />);
  const input = screen.getByRole('textbox', { name: 'Сообщение' });
  await user.type(input, 'Hello');
  await user.keyboard('{Shift>}{Enter}{/Shift}world');
  expect(send).not.toHaveBeenCalled();
  await user.keyboard('{Enter}');
  expect(input).toHaveValue('Hello\nworld');
  await user.click(screen.getByRole('button', { name: 'Отправить сообщение' }));
  expect(input).toHaveValue('');
  expect(send).toHaveBeenCalledTimes(2);
});
it('connects, resolves phone, sends once, receives and disconnects', async () => {
  let resolveSend: ((value: Response) => void) | undefined;
  let receiveCount = 0;
  let receiveSignal: AbortSignal | undefined;
  const fetchMock = vi.fn((url: string, init: RequestInit) => {
    if (url.includes('getStateInstance'))
      return Promise.resolve(Response.json({ stateInstance: 'authorized' }));
    if (url.includes('checkAccount'))
      return Promise.resolve(Response.json({ exist: true, chatId: '123' }));
    if (url.includes('sendMessage'))
      return new Promise<Response>((resolve) => {
        resolveSend = resolve;
      });
    if (url.includes('deleteNotification'))
      return Promise.resolve(Response.json({ result: true }));
    receiveCount++;
    if (receiveCount <= 2) return Promise.resolve(Response.json(notification));
    receiveSignal = init.signal as AbortSignal;
    return new Promise<Response>(() => {});
  });
  vi.stubGlobal('fetch', fetchMock);
  const user = userEvent.setup();
  render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
  await user.type(screen.getByLabelText('idInstance'), '3100000000');
  await user.type(screen.getByLabelText('apiTokenInstance'), 'fake-test-token');
  await user.click(screen.getByRole('button', { name: 'Подключиться →' }));
  await user.type(
    await screen.findByLabelText('Номер собеседника'),
    '+79991234567',
  );
  await user.click(screen.getByRole('button', { name: 'Открыть чат →' }));
  expect(await screen.findByText('Привет')).toBeInTheDocument();
  const input = screen.getByLabelText('Сообщение');
  await user.type(input, 'Ответ');
  fireEvent.keyDown(input, { key: 'Enter' });
  fireEvent.keyDown(input, { key: 'Enter' });
  expect(
    fetchMock.mock.calls.filter((call) => call[0].includes('sendMessage')),
  ).toHaveLength(1);
  expect(
    screen.queryByText('Принято API', { exact: false }),
  ).not.toBeInTheDocument();
  await act(async () => {
    resolveSend!(Response.json({ idMessage: 'sent-1' }));
  });
  expect(input).toHaveValue('');
  expect(screen.getByText('Ответ')).toBeInTheDocument();
  await waitFor(() => expect(receiveSignal).toBeDefined());
  expect(screen.getAllByText('Привет')).toHaveLength(1);
  await user.click(screen.getByRole('button', { name: 'Отключиться' }));
  expect(receiveSignal?.aborted).toBe(true);
  expect(screen.getByLabelText('apiTokenInstance')).toHaveValue('');
  expect(screen.queryByText('Привет')).not.toBeInTheDocument();
});
it('does not connect on unauthorized instance', async () => {
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValue(Response.json({ stateInstance: 'notAuthorized' })),
  );
  const user = userEvent.setup();
  render(<App />);
  await user.type(screen.getByLabelText('idInstance'), '3100000000');
  await user.type(screen.getByLabelText('apiTokenInstance'), 'fake-test-token');
  await user.click(screen.getByRole('button', { name: 'Подключиться →' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('QR');
  expect(screen.queryByLabelText('Номер собеседника')).not.toBeInTheDocument();
});
