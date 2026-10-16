import { useEffect, useRef, useState, type FormEvent } from 'react';
import { GreenApiClient, safeError } from '../services/greenApiClient';
import styles from './Interface.module.css';
export default function ConnectionForm({
  onConnect,
}: {
  onConnect: (client: GreenApiClient) => void;
}) {
  const [id, setId] = useState('');
  const [token, setToken] = useState('');
  const [url, setUrl] = useState('https://3100.api.green-api.com');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  async function connect(event: FormEvent) {
    event.preventDefault();
    if (request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setError('');
    try {
      const client = new GreenApiClient({
        apiUrl: url,
        idInstance: id,
        apiTokenInstance: token,
      });
      await client.connect(controller.signal);
      if (!controller.signal.aborted) {
        setToken('');
        onConnect(client);
      }
    } catch (error) {
      if (!controller.signal.aborted) setError(safeError(error));
    } finally {
      if (!controller.signal.aborted) {
        setBusy(false);
        request.current = null;
      }
    }
  }
  return (
    <main className={styles.welcome}>
      <section className={styles.intro}>
        <div className={styles.brand}>
          <span className={styles.logo}>M</span>
          <strong>MAX</strong>
          <span className={styles.integration}>через GREEN-API</span>
        </div>
        <div>
          <p className={styles.eyebrow}>ПРОСТО ОСТАВАЙТЕСЬ НА СВЯЗИ</p>
          <h1>
            Ваши сообщения.
            <br />
            Ближе, чем кажется.
          </h1>
          <p className={styles.lead}>
            Подключите свой аккаунт MAX и начните разговор. Только вы,
            собеседник и самое важное.
          </p>
        </div>
        <div className={styles.steps}>
          <span>
            01 <b>Подключите инстанс</b>
          </span>
          <span>
            02 <b>Выберите собеседника</b>
          </span>
          <span>
            03 <b>Начните общение</b>
          </span>
        </div>
        <small>Независимый клиент · Текстовые сообщения</small>
      </section>
      <section className={styles.connection}>
        <div className={styles.card}>
          <span className={styles.badge}>GREEN-API × MAX</span>
          <h2>Давайте подключимся</h2>
          <p>Введите данные инстанса из личного кабинета GREEN-API.</p>
          <form onSubmit={(event) => void connect(event)}>
            <label>
              idInstance
              <input
                autoComplete="off"
                inputMode="numeric"
                value={id}
                onChange={(event) => setId(event.target.value)}
                placeholder="Например, 3100000000"
                required
                disabled={busy}
              />
            </label>
            <label>
              apiTokenInstance
              <input
                type="password"
                autoComplete="off"
                value={token}
                onChange={(event) => setToken(event.target.value)}
                placeholder="Ваш токен доступа"
                required
                disabled={busy}
              />
            </label>
            <label>
              apiUrl
              <input
                type="url"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                required
                disabled={busy}
                aria-describedby="url-hint"
              />
            </label>
            <small id="url-hint">
              Скопируйте адрес сервера именно вашего инстанса.
            </small>
            <p className={styles.notice}>
              Используйте отдельный тестовый инстанс. Клиент обрабатывает всю
              очередь: сохраняет тексты в памяти, пропускает и подтверждает
              остальные события. Не подключайте параллельно другой клиент.
            </p>
            {error && (
              <p role="alert" className={styles.error}>
                {error}
              </p>
            )}
            <button
              className={styles.primary}
              disabled={busy || !id.trim() || !token.trim()}
            >
              {busy ? 'Проверяем подключение…' : 'Подключиться →'}
            </button>
          </form>
          <p className={styles.privacy}>
            Токен и переписка хранятся только в памяти этой вкладки. При
            отключении они удаляются.
          </p>
          <a
            href="https://console.green-api.com/"
            target="_blank"
            rel="noreferrer"
          >
            Открыть личный кабинет ↗
          </a>
        </div>
      </section>
    </main>
  );
}
