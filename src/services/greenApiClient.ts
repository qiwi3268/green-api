import type { Credentials } from '../types/chat';
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly retryable = false,
  ) {
    super(message);
  }
}
export function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
export function nonempty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
export function invalidResponse(): never {
  throw new ApiError(
    'Неожиданный формат ответа API. Обработка остановлена, уведомление не удалено.',
  );
}
export function safeError(error: unknown): string {
  return error instanceof ApiError
    ? error.message
    : 'Не удалось выполнить операцию. Проверьте соединение и повторите попытку.';
}
export function validateCredentials(input: Credentials): Credentials {
  const idInstance = input.idInstance.trim();
  const apiTokenInstance = input.apiTokenInstance.trim();
  if (!/^\d+$/.test(idInstance) || !/^[a-zA-Z0-9_-]+$/.test(apiTokenInstance))
    throw new ApiError(
      'Проверьте idInstance и apiTokenInstance из личного кабинета.',
    );
  let url: URL;
  try {
    url = new URL(input.apiUrl.trim());
  } catch {
    throw new ApiError('Укажите корректный apiUrl из личного кабинета.');
  }
  if (
    url.protocol !== 'https:' ||
    !/^(?:[a-z0-9-]+\.)*api\.green-api\.com$/.test(url.hostname) ||
    url.username ||
    url.password ||
    url.port ||
    url.search ||
    url.hash ||
    url.pathname !== '/'
  )
    throw new ApiError(
      'apiUrl должен быть HTTPS-адресом сервера api.green-api.com без пути и параметров.',
    );
  return { apiUrl: url.origin, idInstance, apiTokenInstance };
}
export class GreenApiClient {
  private readonly credentials: Credentials;
  constructor(credentials: Credentials) {
    this.credentials = validateCredentials(credentials);
  }
  private async request(
    method: string,
    verb: string,
    signal: AbortSignal,
    body?: unknown,
    suffix = '',
  ): Promise<unknown> {
    const { apiUrl, idInstance, apiTokenInstance } = this.credentials;
    const timeout = AbortSignal.timeout(40_000);
    try {
      const response = await fetch(
        `${apiUrl}/waInstance${idInstance}/${method}/${encodeURIComponent(apiTokenInstance)}${suffix}`,
        {
          method: verb,
          signal: AbortSignal.any([signal, timeout]),
          credentials: 'omit',
          cache: 'no-store',
          referrerPolicy: 'no-referrer',
          redirect: 'error',
          ...(body === undefined
            ? {}
            : {
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
              }),
        },
      );
      if (!response.ok) {
        const messages: Record<number, string> = {
          400: 'API отклонил запрос. Проверьте параметры и настройки webhookUrl.',
          401: 'Неверные данные доступа. Проверьте инстанс и токен.',
          403: 'Доступ запрещён. Проверьте токен, тариф и ограничения аккаунта.',
          404: 'Инстанс или сервер не найден. Проверьте apiUrl и idInstance.',
          429: 'Превышена частота запросов. Подождите перед следующей попыткой.',
          466: 'Достигнут лимит тарифа GREEN-API.',
        };
        throw new ApiError(
          messages[response.status] ??
            `Ошибка сервиса (HTTP ${response.status}).`,
          response.status === 429 || response.status >= 500,
        );
      }
      try {
        return (await response.json()) as unknown;
      } catch {
        return invalidResponse();
      }
    } catch (error) {
      if (signal.aborted)
        throw new DOMException('Операция отменена', 'AbortError');
      if (error instanceof ApiError) throw error;
      throw new ApiError(
        'Нет ответа от API. Проверьте сеть, apiUrl и доступность CORS. Результат запроса может быть неизвестен.',
        true,
      );
    }
  }
  async connect(signal: AbortSignal) {
    const data = await this.request('getStateInstance', 'GET', signal);
    if (!record(data) || !nonempty(data.stateInstance)) invalidResponse();
    if (data.stateInstance !== 'authorized') {
      const states: Record<string, string> = {
        notAuthorized: 'Авторизуйте инстанс по QR-коду в GREEN-API.',
        starting: 'Инстанс запускается. Повторите подключение позднее.',
        blocked: 'Аккаунт MAX заблокирован.',
        suspended: 'На аккаунте MAX временные ограничения.',
        pendingPassword: 'Завершите двухфакторную авторизацию в GREEN-API.',
      };
      throw new ApiError(
        states[data.stateInstance] ?? 'Инстанс пока не готов к работе.',
      );
    }
  }
  async checkAccount(phone: string, signal: AbortSignal): Promise<string> {
    const data = await this.request('checkAccount', 'POST', signal, {
      phoneNumber: Number(phone),
    });
    if (!record(data)) invalidResponse();
    if (data.status === false)
      throw new ApiError(
        'Инстанс запускается или не авторизован. Переподключитесь.',
      );
    if (data.exist === false)
      throw new ApiError(
        'Аккаунт MAX не найден или поиск по номеру ограничен настройками приватности.',
      );
    if (data.exist !== true || !nonempty(data.chatId)) invalidResponse();
    return data.chatId;
  }
  async sendMessage(
    chatId: string,
    message: string,
    signal: AbortSignal,
  ): Promise<string> {
    if (!message.trim() || message.length > 4000)
      throw new ApiError('Сообщение должно содержать от 1 до 4000 символов.');
    const data = await this.request('sendMessage', 'POST', signal, {
      chatId,
      message,
    });
    if (!record(data) || !nonempty(data.idMessage)) invalidResponse();
    return data.idMessage;
  }
  receive(signal: AbortSignal) {
    return this.request(
      'receiveNotification',
      'GET',
      signal,
      undefined,
      '?receiveTimeout=30',
    );
  }
  async acknowledge(receiptId: number, signal: AbortSignal) {
    const data = await this.request(
      'deleteNotification',
      'DELETE',
      signal,
      undefined,
      `/${receiptId}`,
    );
    if (!record(data) || typeof data.result !== 'boolean') invalidResponse();
    if (!data.result)
      throw new ApiError(
        'API не подтвердил удаление уведомления. Проверьте, что инстанс не используется другим клиентом.',
      );
  }
}
