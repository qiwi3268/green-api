import { useState } from 'react';
import type { GreenApiClient } from '../services/greenApiClient';
import { useChat } from '../hooks/useChat';
import MessageInput from './MessageInput';
import MessageList from './MessageList';
import styles from './Interface.module.css';
export default function Chat({
  client,
  disconnect,
}: {
  client: GreenApiClient;
  disconnect: () => void;
}) {
  const [phone, setPhone] = useState('');
  const state = useChat(client);
  return (
    <main className={styles.workspace}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <span className={styles.logo}>M</span>
          <strong>MAX</strong>
        </div>
        <p className={styles.eyebrow}>ВАШЕ ПРОСТРАНСТВО ДЛЯ ОБЩЕНИЯ</p>
        <h2>Сообщения</h2>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void state.openChat(phone);
          }}
        >
          <label>
            Номер собеседника
            <input
              type="tel"
              autoComplete="tel"
              placeholder="+7 (999) 123-45-67"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              disabled={state.opening || state.sending}
            />
          </label>
          <small>Номера России и Беларуси</small>
          <button
            className={styles.primary}
            disabled={state.opening || state.sending || !phone.trim()}
          >
            {state.opening ? 'Ищем в MAX…' : 'Открыть чат →'}
          </button>
          {state.chatError && (
            <p role="alert" className={styles.error}>
              {state.chatError}
            </p>
          )}
        </form>
        {state.chat && (
          <div className={styles.selectedChat}>
            <span className={styles.avatar}>{state.chat.phone.slice(-2)}</span>
            <div>
              <strong>+{state.chat.phone}</strong>
              <small>Активный разговор</small>
            </div>
          </div>
        )}
        <div className={styles.sidebarBottom}>
          <p>
            <span className={styles.dot} /> Инстанс подключён
          </p>
          <small>Переписка доступна до отключения или закрытия вкладки.</small>
          <button className={styles.secondary} onClick={disconnect}>
            Отключиться
          </button>
        </div>
      </aside>
      <section className={styles.conversation} aria-label="Чат">
        <header className={styles.chatHeader}>
          <div>
            <h1>{state.chat ? `+${state.chat.phone}` : 'Новый разговор'}</h1>
            <p role="status">
              {state.polling.status.state === 'receiving'
                ? 'Получение сообщений активно'
                : state.polling.status.state === 'retrying'
                  ? 'Восстанавливаем получение…'
                  : 'Получение остановлено'}
            </p>
          </div>
          <span className={styles.badge}>MAX</span>
        </header>
        {state.polling.status.state !== 'receiving' && (
          <div className={styles.pollError} role="alert">
            {state.polling.status.detail}
            {state.polling.status.state === 'stopped' && (
              <button
                className={styles.secondary}
                onClick={state.polling.retry}
              >
                Повторить получение
              </button>
            )}
          </div>
        )}
        {state.chat ? (
          <MessageList messages={state.messages} />
        ) : (
          <div className={styles.empty}>
            <span className={styles.emptyIcon}>↗</span>
            <h2>С кем поговорим?</h2>
            <p>
              Введите номер собеседника,
              <br />
              чтобы открыть чат в MAX.
            </p>
          </div>
        )}
        {state.sendError && (
          <p role="alert" className={styles.sendError}>
            {state.sendError}
          </p>
        )}
        <MessageInput
          key={state.chat?.id ?? 'none'}
          send={state.send}
          sending={state.sending}
          disabled={!state.chat || state.opening}
        />
      </section>
    </main>
  );
}
