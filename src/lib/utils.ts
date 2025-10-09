/**
 * Очищает текст от мусора перед отправкой в AI-модели.
 * @param text - Исходный текст поста.
 * @returns Очищенный текст, готовый для использования в качестве промпта.
 */
export function cleanTextForAI(text: string): string {
  if (!text) {
    return '';
  }

  let cleanedText = text;

  // 1. Удаляем все URL-адреса
  cleanedText = cleanedText.replace(/https?:\/\/\S+/g, '');

  // 2. Удаляем Markdown-ссылки вида [текст](url), оставляя только текст
  cleanedText = cleanedText.replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1');

  // 3. Удаляем упоминания (@username) и хештеги (#tag)
  cleanedText = cleanedText.replace(/[@#]\w+/g, '');

  // 4. Удаляем символы форматирования Markdown (*, _, ~, `)
  cleanedText = cleanedText.replace(/[*_~`]/g, '');

  // 5. Удаляем все эмодзи и многие другие символы, не являющиеся текстом
  cleanedText = cleanedText.replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, '');

  // 6. Удаляем возможные слова-триггеры или рекламные метки
  cleanedText = cleanedText.replace(/Реклама\./gi, '');
  cleanedText = cleanedText.replace(/Подписаться/gi, '');


  // 7. Заменяем множественные пробелы и переносы строк на один пробел
  cleanedText = cleanedText.replace(/\s\s+/g, ' ').trim();

  return cleanedText;
}

export function extractPrompt(text: string): string | null {
  const match = text.match(/<prompt>(.*?)<\/prompt>/);
  return match ? match[1].trim() : null;
}
