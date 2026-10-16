export function normalizePhone(input: string): string {
  if (!/^\+?[\d\s()-]+$/.test(input.trim()))
    throw new Error('Введите номер телефона без букв и добавочных номеров.');
  let digits = input.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('8'))
    digits = '7' + digits.slice(1);
  if (!/^(7\d{10}|375\d{9})$/.test(digits))
    throw new Error(
      'Укажите номер РФ (+7, 11 цифр) или Беларуси (+375, 12 цифр).',
    );
  return digits;
}
