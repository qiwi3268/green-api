export const credentials = {
  apiUrl: 'https://3100.api.green-api.com',
  idInstance: '3100000000',
  apiTokenInstance: 'fake-test-token',
};
export const notification = {
  receiptId: 42,
  body: {
    typeWebhook: 'incomingMessageReceived',
    idMessage: 'msg-1',
    timestamp: 1763115112,
    senderData: { chatId: '123', sender: '123' },
    messageData: {
      typeMessage: 'textMessage',
      textMessageData: { textMessage: 'Привет' },
    },
  },
};
