import { useState } from 'react';
import type { GreenApiClient } from '../services/greenApiClient';
import ConnectionForm from '../components/ConnectionForm';
import Chat from '../components/Chat';
export default function App() {
  const [client, setClient] = useState<GreenApiClient | null>(null);
  return client ? (
    <Chat client={client} disconnect={() => setClient(null)} />
  ) : (
    <ConnectionForm onConnect={setClient} />
  );
}
