import CryptoJS from 'crypto-js';

/**
 * Вспомогательная функция для получения ключа шифрования.
 * Она обеспечивает проверку наличия ключа в одном месте.
 * @returns {string} Ключ шифрования.
 * @throws {Error} Если ключ не найден в переменных окружения.
 */
const getEncryptionKey = (): string => {
  const secretKey = process.env.ENCRYPTION_KEY;

  // Проверяем, что ключ существует. Если нет, выбрасываем ошибку.
  // Это немедленно остановит приложение при запуске, если ключ не настроен.
  if (!secretKey) {
    throw new Error('Критическая ошибка: ENCRYPTION_KEY не определен в переменных окружения.');
  }

  // Если ключ есть, возвращаем его. TypeScript теперь видит, что эта функция
  // ВСЕГДА возвращает 'string', а не 'string | undefined', потому что в противном случае она бы "сломалась" на строке throw new Error.
  return secretKey;
}

/**
 * Шифрует переданный текст с использованием AES.
 * @param text - Строка для шифрования (например, stringSession).
 * @returns Зашифрованная строка.
 */
export function encrypt(text: string): string {
  // Получаем ключ через нашу проверенную функцию.
  // Теперь TypeScript не ругается, так как getEncryptionKey() гарантированно возвращает string.
  const secretKey = getEncryptionKey();
  return CryptoJS.AES.encrypt(text, secretKey).toString();
}

/**
 * Дешифрует переданный шифротекст.
 * @param ciphertext - Зашифрованная строка из базы данных.
 * @returns Исходная, расшифрованная строка.
 */
export function decrypt(ciphertext: string): string {
  // Точно так же получаем ключ здесь.
  const secretKey = getEncryptionKey();
  const bytes = CryptoJS.AES.decrypt(ciphertext, secretKey);
  return bytes.toString(CryptoJS.enc.Utf8);
}
