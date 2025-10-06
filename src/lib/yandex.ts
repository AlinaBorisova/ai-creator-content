// if (!process.env.YANDEX_API_KEY || !process.env.YANDEX_FOLDER_ID) {
//   throw new Error('YandexGPT API key or Folder ID are not configured in .env.local');
// }
//
// const yandexApiKey = process.env.YANDEX_API_KEY;
// const yandexFolderId = process.env.YANDEX_FOLDER_ID;
// const yandexApiUrl = 'https://llm.api.cloud.yandex.net/foundationModels/v1/completion';
//
// export interface AiAnalysisResult {
//   rewrittenText: string;
//   imagePrompt: string;
// }
//
// export async function getAiAnalysis(originalText: string): Promise<AiAnalysisResult> {
//   console.log('[AI] Запрос на анализ текста через YandexGPT...');
//
//   const systemPrompt = `
//     Ты — профессиональный SMM-менеджер и копирайтер, мастер создания вовлекающих постов.
//     Твоя задача — проанализировать предоставленный текст и выполнить два действия:
//
//     1.  Рерайт текста (на русском): Сделай качественный рерайт исходного текста на РУССКОМ ЯЗЫКЕ.
//         Твоя цель — не просто пересказать, а сделать текст легко читаемым и визуально привлекательным для соцсетей.
//         Для этого ОБЯЗАТЕЛЬНО следуй этим правилам:
//         -   **Эмодзи:** Уместно используй эмодзи в начале или конце абзацев для добавления эмоций и акцентов. 💡 ✅ 🚀
//         -   **Абзацы:** Разбей сплошной текст на короткие логические абзацы (2-4 предложения).
//         -   **Отступы:** Между абзацами обязательно должны быть пустые строки (визуальные отступы), чтобы текст "дышал".
//         -   **Списки:** Если в тексте есть перечисления, оформляй их в виде маркированного списка (например, с помощью • или -).
//
//     2.  Промпт для изображения (на английском): Создай яркий, детализированный промпт на АНГЛИЙСКОМ ЯЗЫКЕ для нейросети, генерирующей изображения (например, Midjourney или DALL-E). Промпт должен визуально отражать ключевую идею или настроение текста. Он должен быть в стиле "cinematic, hyper-detailed, epic lighting".
//
//     Верни результат в формате JSON, и никак иначе. Вот структура:
//     {
//       "rewrittenText": "Твой отформатированный рерайт на русском языке здесь...",
//       "imagePrompt": "Your detailed English image prompt here..."
//     }
//   `;
//
//   const requestBody = {
//     modelUri: `gpt://${yandexFolderId}/yandexgpt-lite/latest`,
//     completionOptions: {
//       stream: false,
//       temperature: 0.6,
//       maxTokens: "2000"
//     },
//     messages: [
//       { role: "system", text: systemPrompt },
//       { role: "user", text: `Вот текст для анализа:\n\n${originalText}` }
//     ]
//   };
//
//   try {
//     const response = await fetch(yandexApiUrl, {
//       method: 'POST',
//       headers: {
//         'Content-Type': 'application/json',
//         'Authorization': `Api-Key ${yandexApiKey}`
//       },
//       body: JSON.stringify(requestBody)
//     });
//
//     if (!response.ok) {
//       const errorText = await response.text();
//       throw new Error(`YandexGPT API error (${response.status}): ${errorText}`);
//     }
//
//     const data = await response.json();
//     let resultJson = data.result?.alternatives?.[0]?.message?.text;
//
//     if (!resultJson) {
//       throw new Error('AI returned an empty or invalid response structure.');
//     }
//
//     console.log('[AI] Анализ успешно завершен. Получен "сырой" ответ:', resultJson);
//
//     // --- Очистка ответа от Markdown ---
//     const firstBrace = resultJson.indexOf('{');
//     const lastBrace = resultJson.lastIndexOf('}');
//
//     if (firstBrace !== -1 && lastBrace > firstBrace) {
//       resultJson = resultJson.substring(firstBrace, lastBrace + 1);
//     }
//
//     // Нейросеть вернула нам строку в формате JSON, теперь парсим ее в объект
//     return JSON.parse(resultJson) as AiAnalysisResult;
//
//   } catch (error) {
//     console.error('[AI] Ошибка при запросе к YandexGPT API:', error);
//     throw new Error('Не удалось получить анализ от AI.');
//   }
// }
