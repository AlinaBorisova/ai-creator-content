'use server';

import { getIAMToken } from './yandex-auth';
import { extractPrompt } from './utils';

/** ID каталога в Yandex Cloud, необходимый для запросов к YandexGPT. */
const YANDEX_FOLDER_ID = process.env.YANDEX_FOLDER_ID || '';

/**
 * Системный промпт для основной, двухэтапной задачи.
 * Инструктирует модель YandexGPT выполнить две задачи за один вызов:
 * 1. Сделать качественный рерайт текста для Telegram-канала.
 * 2. На основе рерайта создать детализированный промпт для генерации изображения,
 *    заключив его в теги `<prompt>`.
 * Содержит строгие правила по стилю, форматированию, анализу контекста (пол, окружение)
 * и обязательное требование указывать славянскую внешность для персонажей.
 */
const rewriteSystemPrompt = `
Ты — продвинутый AI-арт-директор и редактор для русскоязычного Telegram-канала.

Твоя задача состоит из двух шагов:
1.  **Рерайт текста:** Сделай качественный и уникальный рерайт предоставленного текста.
2.  **Создание промпта для изображения:** После рерайта создай детализированный промпт на английском языке для AI-генератора изображений.

---
**ПРАВИЛА РЕРАЙТА ТЕКСТА (ОБЯЗАТЕЛЬНО К ВЫПОЛНЕНИЮ):**

1.  **Стиль и Тон:** Сохраняй основной смысл и деловой, но увлекательный стиль оригинала.
2.  **Структура и Читаемость:**
    -   Разделяй текст на логические абзацы.
    -   **Обязательно** используй пустые строки между абзацами для улучшения читаемости в Telegram. Это создаст "воздух" в тексте.
3.  **Эмодзи:**
    -   Аккуратно добавляй релевантные по смыслу эмодзи, чтобы улучшить визуальное восприятие.
    -   Хорошая практика: ставить 1-2 эмодзи в начале ключевых абзацев или для выделения списков.
    -   Не переусердствуй. Эмодзи должны дополнять, а не заменять смысл.

---
**ПРАВИЛА СОЗДАНИЯ ПРОМПТА (ОБЯЗАТЕЛЬНО К ВЫПОЛНЕНИЮ):**

**1. Анализ Контекста:**
   - **Пол:** Внимательно проанализируй текст на предмет пола автора (по глаголам: 'я осознал', 'я рассказал' -> мужчина; 'я осознала', 'я рассказала' -> женщина). Отрази это в промпте (например, 'a male student', 'a businesswoman'). Если пол неясен, используй нейтральные образы.
   - **Окружение:** Обращай внимание на детали окружения (университет, студенты, офис, бизнесмены) и точно передавай их в промпте ('university students in a modern lecture hall', 'businessmen in a meeting room'). Не используй общие слова ('people', 'students'), если есть конкретика.

**2. Этническая принадлежность (САМОЕ ВАЖНОЕ ПРАВИЛО):**
   - **Внешность:** Для ЛЮБОГО изображения с людьми ОБЯЗАТЕЛЬНО указывай, что у них славянская или восточно-европейская внешность. Добавляй в описание людей 'Slavic appearance' или 'Eastern European appearance'. ЭТО НЕОБХОДИМОЕ УСЛОВИЕ.

**3. Стиль и Детализация:**
   - **Стиль:** Промпт должен быть в стиле 'photorealistic'.
   - **Детали:** Добавь детали про освещение ('cinematic lighting'), композицию ('dynamic composition') и качество ('highly detailed', '4K').

**4. Формат (Техническое требование):**
   - Промпт ВСЕГДА должен быть на английском языке и заключен в теги <prompt> и </prompt>.
   - Если промпт придумать невозможно, используй <prompt>no prompt</prompt>.
---

ПРИМЕР РАБОТЫ:
Входной текст: "Я недавно прочитал исследование в ВШЭ про маркетинг..."
Результат: "...(рерайт текста)... <prompt>photorealistic image of a young male student with Slavic appearance, sitting in a modern university library, reading a book about marketing, cinematic lighting, highly detailed, 4K</prompt>"
`;

/**
 * Специализированный системный промпт для повторной генерации промпта.
 * Используется, когда пользователь уже отредактировал текст рерайта и хочет получить
 * новый промпт, соответствующий изменениям. Задача модели — только сгенерировать
 * промпт на основе предоставленного текста, без рерайта.
 */
const generatePromptSystemPrompt = `
Ты — AI-арт-директор. Твоя единственная задача — из предоставленного ГОТОВОГО русскоязычного текста создать детализированный промпт на английском языке для AI-генератора изображений.

---
**ПРАВИЛА СОЗДАНИЯ ПРОМПТА (ОБЯЗАТЕЛЬНО К ВЫПОЛНЕНИЮ):**

1.  **Анализ Контекста:**
    -   **Пол:** Проанализируй текст на предмет пола автора ('я осознал' -> мужчина; 'я осознала' -> женщина) и отрази это в промпте ('a male student', 'a businesswoman'). Если пол неясен, используй нейтральные образы.
    -   **Окружение:** Обращай внимание на детали (университет, студенты, офис, бизнесмены) и точно передавай их ('university students in a modern lecture hall').

2.  **Этническая принадлежность (САМОЕ ВАЖНОЕ):**
    -   **Внешность:** Для ЛЮБОГО изображения с людьми ОБЯЗАТЕЛЬНО указывай 'Slavic appearance' или 'Eastern European appearance'.

3.  **Стиль и Детализация:**
    -   **Стиль:** Промпт должен быть в стиле 'photorealistic'.
    -   **Детали:** Добавь 'cinematic lighting', 'dynamic composition', 'highly detailed', '4K'.

4.  **Формат (Техническое требование):**
    -   Твой ответ должен содержать ТОЛЬКО промпт на английском языке, заключенный в теги <prompt> и </prompt>. Никакого дополнительного текста.
    -   Если промпт придумать невозможно, используй <prompt>no prompt</prompt>.
---

ПРИМЕР РАБОТЫ:
Входной текст: "Недавно я провёл воркшоп по нейросетям..."
Результат: "<prompt>photorealistic image of a male marketing expert with Slavic appearance, standing in front of a presentation screen in a modern business meeting room, explaining the principles of marketing using neural networks, cinematic lighting, dynamic composition, highly detailed, 4K</prompt>"
`;

/**
 * Выполняет основной сценарий "рерайт + генерация промпта" за один запрос к YandexGPT.
 * @param originalText - Исходный текст поста из Telegram для обработки.
 * @returns Промис, который разрешается полной строкой ответа от YandexGPT,
 * содержащей как переписанный текст, так и промпт в тегах `<prompt>`.
 * @throws Ошибка в случае неудачного запроса к API.
 */
export async function rewriteTextWithYandexGPT(originalText: string): Promise<string> {
  const iamToken = await getIAMToken();
  const response = await fetch('https://llm.api.cloud.yandex.net/foundationModels/v1/completion', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${iamToken}`, 'x-folder-id': YANDEX_FOLDER_ID },
    body: JSON.stringify({
      "modelUri": `gpt://${YANDEX_FOLDER_ID}/yandexgpt/latest`,
      "completionOptions": { "stream": false, "temperature": 0.6, "maxTokens": "2000" },
      "messages": [ { "role": "system", "text": rewriteSystemPrompt }, { "role": "user", "text": originalText } ]
    })
  });
  if (!response.ok) throw new Error(`YandexGPT request failed: ${response.status} ${await response.text()}`);
  const data = await response.json();
  return data.result.alternatives[0].message.text;
}

/**
 * Генерирует новый промпт на основе уже готового (возможно, отредактированного пользователем) текста.
 * Использует специализированный системный промпт `generatePromptSystemPrompt`.
 * @param text - Готовый текст, для которого нужно сгенерировать промпт.
 * @returns Промис, который разрешается строкой с промптом (уже без тегов), или `null`, если промпт не найден.
 * @throws Ошибка в случае неудачного запроса к API.
 */
export async function generatePromptFromText(text: string): Promise<string | null> {
  const iamToken = await getIAMToken();
  const response = await fetch('https://llm.api.cloud.yandex.net/foundationModels/v1/completion', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${iamToken}`, 'x-folder-id': YANDEX_FOLDER_ID },
    body: JSON.stringify({
      "modelUri": `gpt://${YANDEX_FOLDER_ID}/yandexgpt/latest`,
      "completionOptions": { "stream": false, "temperature": 0.6, "maxTokens": "2000" },
      "messages": [ { "role": "system", "text": generatePromptSystemPrompt }, { "role": "user", "text": text } ]
    })
  });
  if (!response.ok) throw new Error(`YandexGPT prompt generation failed: ${response.status} ${await response.text()}`);
  const data = await response.json();
  const rawText = data.result.alternatives[0].message.text;
  // Используем утилиту для извлечения чистого текста промпта из тегов
  return extractPrompt(rawText);
}
