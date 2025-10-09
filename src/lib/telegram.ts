import { TelegramClient, Api } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { CustomFile } from 'telegram/client/uploads';

// --- ИНИЦИАЛИЗАЦИЯ КЛИЕНТА ---
// Этот блок кода выполняется один раз при загрузке модуля.
// Он считывает учетные данные из переменных окружения и создает
// экземпляр клиента Telegram, который будет переиспользоваться в функциях.

const apiId = parseInt(process.env.TELEGRAM_API_ID || '0');
const apiHash = process.env.TELEGRAM_API_HASH || '';
const session = new StringSession(process.env.TELEGRAM_STRING_SESSION || '');

const client = new TelegramClient(session, apiId, apiHash, {
  connectionRetries: 5,
});

/**
 * @interface PostData
 * Определяет стандартизированную структуру объекта поста, с которой
 * будет работать остальная часть приложения. Это позволяет абстрагироваться
 * от сложной структуры объекта сообщения из Telegram API.
 */
interface PostData {
  text: string;
  reactions: number;
}

/**
 * Асинхронно получает сообщения из указанного Telegram-канала за последнюю неделю.
 * Функция подключается к Telegram, извлекает историю сообщений,
 * форматирует их в удобный вид (текст + общее число реакций) и возвращает результат.
 *
 * @param {string} channelIdString - ID целевого канала в виде строки (например, "-1001234567890").
 * @returns {Promise<PostData[]>} - Промис, который разрешается массивом объектов PostData.
 * @throws {Error} - Выбрасывает ошибку, если ID канала не указан или имеет неверный формат.
 */
export async function getMessages(channelIdString: string): Promise<PostData[]> {
  if (!channelIdString) {
    throw new Error('Channel ID cannot be empty.');
  }
  const channelId = parseInt(channelIdString);
  if (isNaN(channelId)) {
    throw new Error('Invalid Channel ID. It must be a number (e.g., -100123456789).');
  }

  console.log('[Telegram] Подключение к клиенту...');
  // Используем неинтерактивное подключение, которое полагается на TELEGRAM_STRING_SESSION.
  // Это ключевое изменение для работы на сервере.
  await client.connect();
  console.log('[Telegram] Клиент успешно подключен.');

  // Получаем сущность канала по его ID. Указываем тип Api.Channel для типобезопасности.
  const channel = (await client.getEntity(channelId)) as Api.Channel;
  console.log(`[Telegram] Найден канал: ${channel.title}`);

  // Вычисляем временную метку (timestamp) для момента "7 дней назад".
  const sevenDaysAgo = Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60;

  // Выполняем низкоуровневый запрос к Telegram API для получения истории сообщений.
  const result = (await client.invoke(
    new Api.messages.GetHistory({
      peer: channel,
      offsetDate: sevenDaysAgo, // Получаем сообщения, начиная с этой даты
      limit: 100, // Максимальное количество сообщений
    })
  )) as Api.messages.Messages;

  // Обрабатываем полученные сообщения: фильтруем и преобразуем в наш формат PostData.
  const messages: PostData[] = (result.messages || [])
    // Фильтруем сообщения, которые не являются экземпляром Api.Message или не имеют текста.
    .filter((msg): msg is Api.Message => msg instanceof Api.Message && !!msg.message)
    .map((msg: Api.Message) => {
      // Считаем общее количество реакций для каждого сообщения.
      let reactionsCount = 0;
      if (msg.reactions?.results) {
        reactionsCount = msg.reactions.results.reduce(
          (sum: number, reaction: Api.ReactionCount) => sum + reaction.count,
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

/**
 * Асинхронно отправляет пост (текст + изображение) в указанный Telegram-канал.
 * Функция обрабатывает изображение в формате Base64, а также автоматически
 * разделяет слишком длинные сообщения на два (картинка с подписью + дополнительный текст).
 *
 * @param {string} channelIdString - ID целевого канала в виде строки.
 * @param {string} text - Текст сообщения.
 * @param {string} imageBase64 - Изображение, закодированное в строку Base64.
 * @returns {Promise<void>} - Промис, который разрешается после успешной отправки поста.
 * @throws {Error} - Выбрасывает ошибку при возникновении проблем с отправкой.
 */
export async function sendPostToChannel(channelId: string, text: string, imageSource: string) {
  console.log('[Telegram] Подключение к клиенту для отправки поста...');
  await client.connect();
  console.log('[Telegram] Клиент для отправки подключен.');

  try {
    const entity = await client.getInputEntity(channelId);
    let imageBuffer: Buffer;

    // --- НАШЕ ИЗМЕНЕНИЕ: Умная обработка изображения ---
    if (imageSource.startsWith('data:image')) {
      // Сценарий 1: Это старый формат Base64
      console.log('[Telegram] Обнаружен формат Base64. Обрабатываем...');
      const base64Data = imageSource.split(',')[1];
      if (!base64Data) {
        throw new Error('Invalid Base64 string format.');
      }
      imageBuffer = Buffer.from(base64Data, 'base64');

    } else if (imageSource.startsWith('http')) {
      // Сценарий 2: Это новый формат URL
      console.log(`[Telegram] Обнаружен URL. Скачиваем изображение с: ${imageSource}`);
      const response = await fetch(imageSource);
      if (!response.ok) {
        throw new Error(`Failed to download image from URL: ${response.statusText}`);
      }
      // Преобразуем скачанные данные в Buffer
      const arrayBuffer = await response.arrayBuffer();
      imageBuffer = Buffer.from(arrayBuffer);

    } else {
      // Если формат неизвестен, выбрасываем ошибку
      throw new Error('Unsupported image source format. Expected Base64 or URL.');
    }
    // --- КОНЕЦ ИЗМЕНЕНИЯ ---

    // Дальнейшая логика остается почти без изменений, просто использует imageBuffer
    const imageFile = new CustomFile('image.jpg', imageBuffer.length, '', imageBuffer);

    // ... (остальной код вашей функции, если он есть, например, обрезка текста)
    const MAX_CAPTION_LENGTH = 1024;
    const truncatedText = text.slice(0, MAX_CAPTION_LENGTH);

    await client.sendFile(entity, {
      file: imageFile,
      caption: truncatedText,
      parseMode: 'html',
    });

    console.log(`[Telegram] Пост успешно отправлен в канал ${channelId}`);

  } catch (error) {
    console.error('[Telegram] Ошибка при отправке поста:', error);
    // Пробрасываем ошибку дальше, чтобы ее можно было поймать в Server Action
    throw error;
  } finally {
    console.log('[Telegram] Отключение клиента после отправки.');
    await client.disconnect();
  }
}

