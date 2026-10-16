import { useState } from 'react';
import styles from './Interface.module.css';
export default function MessageInput({
  send,
  sending,
  disabled,
}: {
  send: (text: string) => Promise<boolean>;
  sending: boolean;
  disabled: boolean;
}) {
  const [text, setText] = useState('');
  async function submit() {
    if (!disabled && !sending && text.trim() && (await send(text))) setText('');
  }
  return (
    <form
      className={styles.composer}
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <div className={styles.inputRow}>
        <textarea
          aria-label="Сообщение"
          placeholder="Напишите сообщение…"
          value={text}
          maxLength={4000}
          disabled={disabled || sending}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (
              event.key === 'Enter' &&
              !event.shiftKey &&
              !event.nativeEvent.isComposing
            ) {
              event.preventDefault();
              void submit();
            }
          }}
          rows={2}
        />
        <button
          className={styles.primary}
          aria-label="Отправить сообщение"
          disabled={disabled || sending || !text.trim()}
        >
          {sending ? 'Отправка…' : 'Отправить ↑'}
        </button>
      </div>
      <div className={styles.composerHint}>
        <span>Enter — отправить · Shift + Enter — новая строка</span>
        <span>{text.length} / 4000</span>
      </div>
    </form>
  );
}
