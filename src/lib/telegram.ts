// src/lib/telegram.ts

import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { Api } from 'telegram/tl';

export interface TelegramMessage {
  id: number;
  text: string;
  date: number;
  totalReactions: number;
  reactions: Array<{
    emoji: string;
    count: number;
  }>;
}

const apiId = Number(process.env.TELEGRAM_API_ID);
const apiHash = process.env.TELEGRAM_API_HASH || '';
const session = process.env.TELEGRAM_SESSION || '';

if (!apiId || !apiHash || !session) {
  throw new Error('Telegram API credentials are not configured in .env.local');
}

const stringSession = new StringSession(session);

function cleanMessageText(text: string): string {
  let cleanedText = text;

  // Удаляем рекламные блоки
  const adPattern = /\n\n?Реклама\.[\s\S]*?Erid:[\s\S]*/is;
  cleanedText = cleanedText.replace(adPattern, '');

  // Удаляем символы форматирования (спойлеры, жирный, курсив и т.д.)
  cleanedText = cleanedText.replace(/\|\|/g, '');
  cleanedText = cleanedText.replace(/[*_~`]/g, '');

  // --- НОВАЯ СТРОКА: Удаляем упоминания (@username) ---
  // Регулярное выражение /@\w+/g находит все слова, начинающиеся с @
  cleanedText = cleanedText.replace(/@\w+/g, '');

  // Удаляем эмодзи (используем обратно-совместимую версию)
  const emojiPattern = /(?:[\u2700-\u27bf]|(?:\ud83c[\udde6-\uddff]){2}|[\ud800-\udbff][\udc00-\udfff]|[\u0023-\u0039]\ufe0f?\u20e3|\u3299|\u3297|\u303d|\u3030|\u24c2|\ud83c[\udd70-\udd71]|\ud83c[\udd7e-\udd7f]|\ud83c\udd8e|\ud83c[\udd91-\udd9a]|\ud83c[\udde6-\uddff]|\ud83c[\ude01-\ude02]|\ud83c\ude1a|\ud83c\ude2f|\ud83c[\ude32-\ude3a]|\ud83c[\ude50-\ude51]|\u203c|\u2049|[\u25aa-\u25ab]|\u25b6|\u25c0|[\u25fb-\u25fe]|\u00a9|\u00ae|\u2122|\u2139|\ud83c\udc04|[\u2600-\u26FF]|\u2b05|\u2b06|\u2b07|\u2b1b|\u2b1c|\u2b50|\u2b55|\u231a|\u231b|\u2328|\u23cf|[\u23e9-\u23f3]|[\u23f8-\u23fa]|\ud83c\udccf|\u2934|\u2935|[\u2190-\u21ff])/g;
  cleanedText = cleanedText.replace(emojiPattern, '');

  // Сжимаем множественные пробелы и переносы строк в один пробел и обрезаем по краям
  cleanedText = cleanedText.replace(/\s+/g, ' ').trim();

  return cleanedText;
}

export async function getMessagesFromChannel(channelIdentifier: string): Promise<TelegramMessage[]> {
  console.log(`[Telegram] Попытка подключения...`);
  const client = new TelegramClient(stringSession, apiId, apiHash, {
    connectionRetries: 5,
  });

  try {
    const trimmedIdentifier = channelIdentifier.trim();
    const numericId = parseInt(trimmedIdentifier, 10);
    let entityIdentifier: string | number;
    if (!isNaN(numericId)) {
      entityIdentifier = numericId;
    } else {
      entityIdentifier = trimmedIdentifier;
    }

    await client.connect();
    const entity = await client.getEntity(entityIdentifier);

    if (!entity || !('title' in entity)) {
      throw new Error(`Сущность с идентификатором "${channelIdentifier}" не является каналом или чатом, либо не найдена.`);
    }

    console.log(`[Telegram] Найден канал: ${entity.title}`);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoTimestamp = Math.floor(sevenDaysAgo.getTime() / 1000);

    const messages: TelegramMessage[] = [];

    for await (const message of client.iterMessages(entity, { limit: 200 })) {
      if (message.date < sevenDaysAgoTimestamp) break;

      if (message.text) {
        const cleanedText = cleanMessageText(message.text);
        if (cleanedText) {
          let totalReactions = 0;
          let reactionDetails: TelegramMessage['reactions'] = [];

          if (message.reactions && message.reactions.results.length > 0) {
            totalReactions = message.reactions.results.reduce((sum, r) => sum + r.count, 0);

            reactionDetails = message.reactions.results.reduce((acc, r) => {
              if (r.reaction && r.reaction instanceof Api.ReactionEmoji) {
                acc.push({
                  emoji: r.reaction.emoticon,
                  count: r.count,
                });
              }
              return acc;
            }, [] as TelegramMessage['reactions']);
          }

          messages.push({
            id: message.id,
            text: cleanedText,
            date: message.date,
            totalReactions: totalReactions,
            reactions: reactionDetails,
          });
        }
      }
    }

    console.log(`[Telegram] Найдено ${messages.length} сообщений за последнюю неделю.`);
    return messages;

  } catch (error) {
    console.error('[Telegram] Произошла ошибка:', error);
    throw error;
  } finally {
    console.log('[Telegram] Отключение от клиента...');
    await client.disconnect();
  }
}
