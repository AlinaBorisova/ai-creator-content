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

  // 5. Удаляем возможные слова-триггеры или рекламные метки
  cleanedText = cleanedText.replace(/Реклама\./gi, '');
  cleanedText = cleanedText.replace(/Подписаться/gi, '');


  // 6. Заменяем множественные пробелы и переносы строк на один пробел
  cleanedText = cleanedText.replace(/\s\s+/g, ' ').trim();

  return cleanedText;
}

export function extractPrompt(text: string): string | null {
  const match = text.match(/<prompt>(.*?)<\/prompt>/);
  return match ? match[1].trim() : null;
}
