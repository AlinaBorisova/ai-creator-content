import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js'; // Важно указать .js в конце для некоторых версий
import input from 'input';
import 'dotenv/config';

const apiId = parseInt(process.env.TELEGRAM_API_ID, 10);
const apiHash = process.env.TELEGRAM_API_HASH;

// Создаем пустую сессию. После входа она заполнится данными.
const stringSession = new StringSession('');

(async () => {
  console.log('Запускаем генератор сессии...');
  const client = new TelegramClient(stringSession, apiId, apiHash, {
    connectionRetries: 5,
  });

  await client.start({
    phoneNumber: async () => await input.text('Введите ваш номер телефона: '),
    password: async () => await input.text('Введите ваш пароль (если есть): '),
    phoneCode: async () => await input.text('Введите код, полученный в Telegram: '),
    onError: (err) => console.log(err),
  });

  console.log('\nВы успешно вошли в аккаунт!');

  const sessionString = client.session.save();
  console.log('ВАША СТРОКА СЕССИИ (скопируйте ее полностью):');
  console.log('--------------------------------------------------');
  console.log(sessionString);
  console.log('--------------------------------------------------');
  console.log('Теперь добавьте эту строку в файл .env.local как TELEGRAM_SESSION');

  await client.disconnect();
})();
