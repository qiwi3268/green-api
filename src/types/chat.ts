export interface Message {
  id: string;
  chatId: string;
  sender: string;
  text: string;
  timestamp: number;
  direction: 'incoming' | 'outgoing';
}
export interface Chat {
  id: string;
  phone: string;
}
export interface Credentials {
  apiUrl: string;
  idInstance: string;
  apiTokenInstance: string;
}
