import { TelegramClient, Api } from 'telegram';
import { StringSession } from 'telegram/sessions';
import input from 'input';

const apiId = parseInt(process.env.TELEGRAM_API_ID || '0');
const apiHash = process.env.TELEGRAM_API_HASH || '';
const session = new StringSession(process.env.TELEGRAM_STRING_SESSION || '');

const client = new TelegramClient(session, apiId, apiHash, {
  connectionRetries: 5,
});

// Определяем интерфейс для возвращаемых данных
interface PostData {
  text: string;
  reactions: number;
}

export async function getMessages(channelIdString: string): Promise<PostData[]> {
  if (!channelIdString) {
    throw new Error('Channel ID cannot be empty.');
  }
  const channelId = parseInt(channelIdString);
  if (isNaN(channelId)) {
    throw new Error('Invalid Channel ID. It must be a number (e.g., -100123456789).');
  }

  console.log('[Telegram] Подключение к клиенту...');

  await client.start({
    phoneNumber: async () => await input.text('Please enter your number: '),
    password: async () => await input.text('Please enter your password: '),
    phoneCode: async () => await input.text('Please enter the code you received: '),
    onError: (err) => console.log(err),
  });

  console.log('[Telegram] Клиент успешно подключен.');

  const channel = await client.getEntity(channelId) as any;
  console.log(`[Telegram] Найден канал: ${channel.title}`);

  const sevenDaysAgo = Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60;

  const result = await client.invoke(
    new Api.messages.GetHistory({
      peer: channel,
      offsetDate: sevenDaysAgo,
      limit: 100,
    })
  ) as any;

  // Теперь мы обрабатываем сообщения, чтобы получить и текст, и реакции
  const messages: PostData[] = result.messages
    .filter((msg: any) => msg && msg.message) // Фильтруем пустые сообщения
    .map((msg: any) => {
      // Считаем общее количество реакций
      let reactionsCount = 0;
      if (msg.reactions?.results) {
        reactionsCount = msg.reactions.results.reduce(
          (sum: number, reaction: any) => sum + reaction.count,
          0
        );
      }
      return {
        text: msg.message,
        reactions: reactionsCount,
      };
    });

  console.log(`[Telegram] Найдено ${messages.length} сообщений с реакциями за последнюю неделю.`);
  await client.disconnect();

  return messages;
}
