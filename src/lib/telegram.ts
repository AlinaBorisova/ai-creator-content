import { TelegramClient, Api } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { CustomFile } from 'telegram/client/uploads';
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

// ==========================================================
// ФУНКЦИЯ ДЛЯ ОТПРАВКИ ПОСТА
// ==========================================================
export async function sendPostToChannel(channelIdString: string, text: string, imageBase64: string): Promise<void> {
  if (!channelIdString) throw new Error('Channel ID cannot be empty for sending.');
  const channelId = parseInt(channelIdString);
  if (isNaN(channelId)) throw new Error('Invalid Channel ID for sending.');
  if (!imageBase64) throw new Error('Image is required for sending a post.');

  console.log('[Telegram] Подключение к клиенту для отправки поста...');
  await client.connect();
  console.log('[Telegram] Клиент для отправки подключен.');

  try {
    const channel = await client.getEntity(channelId) as any;
    const base64Data = imageBase64.split(',')[1];
    const imageBuffer = Buffer.from(base64Data, 'base64');
    const imageFile = new CustomFile('image.jpg', imageBuffer.length, '', imageBuffer);

    // Определяем лимит для подписи
    const CAPTION_LIMIT = 1024;

    console.log(`[Telegram] Отправка поста в канал "${channel.title}"...`);

    // Проверяем длину текста
    if (text.length > CAPTION_LIMIT) {
      console.log('[Telegram] Текст слишком длинный, будет разделен на два сообщения.');

      // Разделяем текст
      const caption = text.substring(0, CAPTION_LIMIT);
      const followUpMessage = text.substring(CAPTION_LIMIT);

      // 1. Отправляем картинку с первой частью текста
      await client.sendMessage(channel, {
        message: caption,
        file: imageFile,
      });

      // 2. Отправляем остаток текста отдельным сообщением
      await client.sendMessage(channel, {
        message: followUpMessage,
      });

    } else {
      // Если текст в пределах лимита, отправляем как обычно
      await client.sendMessage(channel, {
        message: text,
        file: imageFile,
      });
    }

    console.log('[Telegram] Пост успешно отправлен!');

  } catch (error) {
    console.error('[Telegram] Ошибка при отправке поста:', error);
    throw error;
  } finally {
    console.log('[Telegram] Отключение клиента после отправки.');
    await client.disconnect();
  }
}
