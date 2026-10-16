import { useEffect, useRef } from 'react';
import type { Message } from '../types/chat';
import styles from './Interface.module.css';
export default function MessageList({ messages }: { messages: Message[] }) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: 'auto', block: 'end' });
  }, [messages]);
  return (
    <div
      className={styles.messages}
      role="log"
      aria-label="История сообщений"
      aria-live="polite"
      aria-relevant="additions"
    >
      <p className={styles.sessionNote}>История текущей сессии</p>
      {messages.length === 0 && (
        <div className={styles.empty}>
          <span className={styles.emptyIcon}>↗</span>
          <h2>Начните разговор</h2>
          <p>
            Отправьте первое сообщение.
            <br />
            Ответ из MAX появится здесь.
          </p>
        </div>
      )}
      {messages.map((message) => (
        <article
          key={`${message.chatId}:${message.id}`}
          className={`${styles.bubble} ${message.direction === 'outgoing' ? styles.outgoing : styles.incoming}`}
          aria-label={message.direction === 'outgoing' ? 'Вы' : 'Собеседник'}
        >
          <p>{message.text}</p>
          <footer>
            <time dateTime={new Date(message.timestamp).toISOString()}>
              {new Date(message.timestamp).toLocaleTimeString('ru-RU', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </time>
            {message.direction === 'outgoing' && (
              <span title="Принято GREEN-API, доставка не подтверждена">
                {' '}
                · Принято API
              </span>
            )}
          </footer>
        </article>
      ))}
      <div ref={end} />
    </div>
  );
}
