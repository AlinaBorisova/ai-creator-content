import { GroundingMetadata } from '@/types/stream';

const GOOGLE_AI_API_KEY = process.env.GOOGLE_AI_API_KEY;

if (!GOOGLE_AI_API_KEY) {
  throw new Error('GOOGLE_AI_API_KEY is missing');
}

// Тип для версии модели Gemini
export type GeminiModelVersion = 'gemini-2.5-pro' | 'gemini-3-pro-preview';

export async function streamTextViaGeminiDirect(
  prompt: string,
  onDelta: (chunk: string) => void,
  signal?: AbortSignal,
  modelVersion: GeminiModelVersion = 'gemini-2.5-pro',
): Promise<string> {
  const cleaned = prompt.trim();

  if (!prompt || cleaned.length < 5) {
    throw new Error('Prompt is too short');
  }
  if (cleaned.length > 50000) {
    throw new Error('Prompt is too long');
  }

  try {
    console.log('🚀 Starting Gemini generation for prompt:', cleaned.slice(0, 50));
    console.log('📌 Using model:', modelVersion);

    // Создаем AbortController с таймаутом
    const timeoutController = new AbortController();
    const timeoutMs = 180000; // 180 секунд (3 минуты)
    const timeoutId = setTimeout(() => timeoutController.abort(), timeoutMs);
    // Объединяем сигналы: пользовательский abort и таймаут
    let combinedSignal: AbortSignal;
    if (signal) {
      // Если есть пользовательский signal, создаем комбинированный
      const combinedController = new AbortController();
      signal.addEventListener('abort', () => combinedController.abort());
      timeoutController.signal.addEventListener('abort', () => combinedController.abort());
      combinedSignal = combinedController.signal;
    } else {
      combinedSignal = timeoutController.signal;
    }

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelVersion}:generateContent?key=${GOOGLE_AI_API_KEY}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: cleaned
                  }
                ]
              }
            ],
            generationConfig: {
              // Для Gemini 3 используем дефолтное значение (не указываем или 1.0)
              // Для Gemini 2.5 оставляем 0.7
              ...(modelVersion === 'gemini-3-pro-preview'
                ? {} // Gemini 3: используем дефолт (1.0)
                : { temperature: 0.7 } // Gemini 2.5: явно указываем 0.7
              ),
              topK: 40,
              topP: 0.95,
              maxOutputTokens: 32768
            },
          }),
          signal: combinedSignal
        }
      );

      clearTimeout(timeoutId); // Очищаем таймаут при успешном ответе

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ API Error Response:', errorText);
        throw new Error(`HTTP error! status: ${response.status}, details: ${errorText}`);
      }

      const data = await response.json();
      console.log('📊 API Response structure:', JSON.stringify(data, null, 2));

      // Правильное извлечение текста из ответа
      let fullText = '';

      if (data.candidates && data.candidates.length > 0) {
        const candidate = data.candidates[0];

        // Детальное логирование структуры ответа
        console.log('🔍 Candidate structure:', {
          hasContent: !!candidate.content,
          contentType: typeof candidate.content,
          contentKeys: candidate.content ? Object.keys(candidate.content) : [],
          hasParts: !!(candidate.content && candidate.content.parts),
          partsLength: candidate.content?.parts?.length || 0,
          finishReason: candidate.finishReason,
          finishMessage: candidate.finishMessage,
          safetyRatings: candidate.safetyRatings
        });

        if (candidate.content) {
          // Проверяем разные возможные структуры ответа
          if (candidate.content.parts && candidate.content.parts.length > 0) {
            fullText = candidate.content.parts[0].text || '';
          } else if (candidate.content.text) {
            // Альтернативная структура, если текст напрямую в content
            fullText = candidate.content.text;
          } else if (typeof candidate.content === 'string') {
            // Если content - это строка
            fullText = candidate.content;
          } else {
            // Если content пустой объект, проверяем причину
            console.warn('⚠️ Content is empty object. Checking reasons...');
          }
        }

        // Проверяем finishReason на наличие блокировок
        if (candidate.finishReason) {
          if (candidate.finishReason !== 'STOP') {
            console.warn('⚠️ Finish reason:', candidate.finishReason, candidate.finishMessage || '');
            if (candidate.finishReason === 'SAFETY' || candidate.finishReason === 'RECITATION') {
              throw new Error(`Content blocked: ${candidate.finishReason} - ${candidate.finishMessage || 'No message'}`);
            }
          }
        }

        // Проверяем safety ratings
        if (candidate.safetyRatings && candidate.safetyRatings.length > 0) {
          const blockedRatings = candidate.safetyRatings.filter(
            (rating: { blocked: boolean; category?: string; probability?: string }) => rating.blocked
          );
          if (blockedRatings.length > 0) {
            const blockedCategories = blockedRatings.map((r: { category?: string }) => r.category).filter(Boolean);
            console.warn('⚠️ Content blocked by safety filters:', blockedCategories);
            throw new Error(`Content blocked by safety filters: ${blockedCategories.join(', ')}`);
          }
        }

        // Если content пустой, но finishReason STOP - это баг API
        if (!fullText && candidate.finishReason === 'STOP') {
          if (candidate.content && Object.keys(candidate.content).length === 0) {
            console.error('⚠️ Empty content object with STOP finishReason. This might be a Gemini API issue.');
            console.error('Full candidate:', JSON.stringify(candidate, null, 2));
            throw new Error('Empty content received from Gemini API despite STOP finishReason. Please try again.');
          } else if (!candidate.content) {
            console.error('⚠️ No content field with STOP finishReason.');
            console.error('Full candidate:', JSON.stringify(candidate, null, 2));
            throw new Error('No content field in Gemini API response despite STOP finishReason. Please try again.');
          }
        }
      }

      console.log('📝 Extracted text length:', fullText.length);
      console.log('📝 First 100 chars:', fullText.slice(0, 100));

      if (!fullText) {
        console.error('❌ No text in response. Full response:', JSON.stringify(data, null, 2));
        throw new Error('No text generated');
      }

      // Эмулируем стриминг
      const chunkSize = 50;
      for (let i = 0; i < fullText.length; i += chunkSize) {
        if (signal?.aborted || timeoutController.signal.aborted) {
          throw new Error('Aborted');
        }

        const chunk = fullText.slice(i, i + chunkSize);
        onDelta(chunk);

        await new Promise(resolve => setTimeout(resolve, 50));
      }

      console.log('✅ Generation completed, total length:', fullText.length);
      return fullText;
    } finally {
      clearTimeout(timeoutId); // Очищаем таймаут в любом случае
    }
  } catch (error) {
    console.error('❌ Gemini API Error:', error);
    if (signal?.aborted) {
      throw new Error('Aborted');
    }

    // Улучшенная обработка сетевых ошибок
    if (error instanceof Error) {
      if (error.name === 'AbortError' || error.message.includes('aborted')) {
        throw new Error('Request was aborted or timed out');
      }
      if (error.message.includes('fetch failed') || error.message.includes('SocketError')) {
        throw new Error('Network error: Connection to Gemini API failed. Please check your internet connection and try again.');
      }
    }

    throw new Error(`Gemini API Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Функция для Google Search grounding
export async function streamTextViaGeminiWithSearch(
  prompt: string,
  onDelta: (chunk: string) => void,
  signal?: AbortSignal,
  modelVersion: GeminiModelVersion = 'gemini-2.5-pro',
): Promise<{ text: string; groundingMetadata?: GroundingMetadata }> {
  const cleaned = prompt.trim();

  if (!prompt || cleaned.length < 5) {
    throw new Error('Prompt is too short');
  }
  if (cleaned.length > 50000) {
    throw new Error('Prompt is too long');
  }

  try {
    console.log('🔍 Starting Gemini generation with Google Search for prompt:', cleaned.slice(0, 50));
    console.log('📌 Using model:', modelVersion);

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelVersion}:generateContent?key=${GOOGLE_AI_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: cleaned
                }
              ]
            }
          ],
          tools: [
            {
              google_search: {}
            }
          ],
          generationConfig: {
            // Для Gemini 3 используем дефолтное значение (не указываем или 1.0)
            // Для Gemini 2.5 оставляем 0.7
            ...(modelVersion === 'gemini-3-pro-preview'
              ? {} // Gemini 3: используем дефолт (1.0)
              : { temperature: 0.7 } // Gemini 2.5: явно указываем 0.7
            ),
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 32768
          },
        }),
        signal
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API Error Response:', errorText);
      throw new Error(`HTTP error! status: ${response.status}, details: ${errorText}`);
    }

    const data = await response.json();
    console.log('📊 API Response with grounding:', JSON.stringify(data, null, 2));

    // Извлечение текста и метаданных
    let fullText = '';
    let groundingMetadata: GroundingMetadata | undefined = undefined;

    if (data.candidates && data.candidates.length > 0) {
      const candidate = data.candidates[0];

      // Детальное логирование структуры ответа
      console.log('🔍 Candidate structure:', {
        hasContent: !!candidate.content,
        contentType: typeof candidate.content,
        contentKeys: candidate.content ? Object.keys(candidate.content) : [],
        hasParts: !!(candidate.content && candidate.content.parts),
        partsLength: candidate.content?.parts?.length || 0,
        finishReason: candidate.finishReason,
        finishMessage: candidate.finishMessage,
        safetyRatings: candidate.safetyRatings,
        hasGroundingMetadata: !!candidate.groundingMetadata
      });

      // Проверяем finishReason на наличие блокировок
      if (candidate.finishReason) {
        if (candidate.finishReason !== 'STOP') {
          console.warn('⚠️ Finish reason:', candidate.finishReason, candidate.finishMessage || '');
          if (candidate.finishReason === 'SAFETY' || candidate.finishReason === 'RECITATION') {
            throw new Error(`Content blocked: ${candidate.finishReason} - ${candidate.finishMessage || 'No message'}`);
          }
          if (candidate.finishReason === 'MAX_TOKENS') {
            throw new Error(`Response truncated: ${candidate.finishMessage || 'Max tokens reached'}`);
          }
        }
      }

      // Проверяем safety ratings
      if (candidate.safetyRatings && candidate.safetyRatings.length > 0) {
        const blockedRatings = candidate.safetyRatings.filter(
          (rating: { blocked: boolean; category?: string; probability?: string }) => rating.blocked
        );
        if (blockedRatings.length > 0) {
          const blockedCategories = blockedRatings.map((r: { category?: string }) => r.category).filter(Boolean);
          console.warn('⚠️ Content blocked by safety filters:', blockedCategories);
          throw new Error(`Content blocked by safety filters: ${blockedCategories.join(', ')}`);
        }
      }

      // Извлекаем текст из разных возможных структур
      if (candidate.content) {
        if (candidate.content.parts && candidate.content.parts.length > 0) {
          // Стандартная структура: parts[0].text
          fullText = candidate.content.parts[0].text || '';

          // Проверяем, есть ли другие части (function calls и т.д.)
          if (candidate.content.parts.length > 1) {
            console.log('⚠️ Multiple parts in response:', candidate.content.parts.length);
            for (let i = 0; i < candidate.content.parts.length; i++) {
              const part = candidate.content.parts[i];
              console.log(`Part ${i}:`, {
                hasText: !!part.text,
                hasFunctionCall: !!part.functionCall,
                keys: Object.keys(part)
              });
            }
          }
        } else if (candidate.content.text) {
          // Альтернативная структура: текст напрямую в content
          fullText = candidate.content.text;
        } else if (typeof candidate.content === 'string') {
          // Если content - это строка
          fullText = candidate.content;
        } else {
          // Если content пустой объект или содержит только role
          console.warn('⚠️ Content structure unexpected:', JSON.stringify(candidate.content, null, 2));

          // Проверяем, может быть это function call вместо текста
          if (candidate.content.parts) {
            const functionCalls = candidate.content.parts.filter((p: { functionCall?: unknown; text?: string }) => p.functionCall);
            if (functionCalls.length > 0) {
              console.log('⚠️ Response contains function calls instead of text:', functionCalls.length);
              throw new Error('Model returned function calls instead of text. This might indicate an API configuration issue.');
            }
          }
        }
      }

      // Извлекаем grounding metadata
      if (candidate.groundingMetadata) {
        groundingMetadata = candidate.groundingMetadata as GroundingMetadata;
        console.log('🔍 Grounding metadata details:', {
          hasWebSearchQueries: !!groundingMetadata.webSearchQueries,
          queriesCount: groundingMetadata.webSearchQueries?.length || 0,
          hasGroundingChunks: !!groundingMetadata.groundingChunks,
          chunksCount: groundingMetadata.groundingChunks?.length || 0
        });

        // Проверяем на пустые поисковые запросы - это признак проблемы
        if (groundingMetadata.webSearchQueries && groundingMetadata.webSearchQueries.length > 0) {
          const validQueries = groundingMetadata.webSearchQueries.filter((q: string) => q && q.trim() !== '');
          const emptyQueries = groundingMetadata.webSearchQueries.length - validQueries.length;
          if (emptyQueries > 0) {
            console.warn(`⚠️ ${emptyQueries} empty search query/queries detected out of ${groundingMetadata.webSearchQueries.length}`);
          }
          if (validQueries.length === 0 && !fullText) {
            // Все запросы пустые и нет текста - это проблема
            console.error('⚠️ All search queries are empty and no text generated. This might indicate the prompt is too vague or incomplete.');
          }
        }

        // Если content пустой, но finishReason STOP - это проблема
        if (!fullText && candidate.finishReason === 'STOP') {
          // Проверяем, есть ли пустые поисковые запросы
          const hasEmptyQueries = groundingMetadata?.webSearchQueries?.some((q: string) => !q || q.trim() === '');
          const hasNoQueries = !groundingMetadata?.webSearchQueries || groundingMetadata.webSearchQueries.length === 0;

          if (hasEmptyQueries || hasNoQueries) {
            console.error('⚠️ Empty or missing search queries detected. This might be because:');
            console.error('  1. The prompt is too short or incomplete');
            console.error('  2. The prompt does not contain a clear research question');
            console.error('  3. The model could not determine what to search for');
            console.error('Full candidate:', JSON.stringify(candidate, null, 2));
            throw new Error('Model failed to generate search queries. Please provide a more specific and complete prompt that clearly indicates what information needs to be researched.');
          }

          if (candidate.content && Object.keys(candidate.content).length === 0) {
            console.error('⚠️ Empty content object with STOP finishReason.');
            console.error('Full candidate:', JSON.stringify(candidate, null, 2));
            throw new Error('Empty content received from Gemini API despite STOP finishReason. Please try again.');
          } else if (!candidate.content) {
            console.error('⚠️ No content field with STOP finishReason.');
            console.error('Full candidate:', JSON.stringify(candidate, null, 2));
            throw new Error('No content field in Gemini API response despite STOP finishReason. Please try again.');
          } else if (candidate.content && candidate.content.role && !candidate.content.parts) {
            // Специальный случай: content есть, но только с role, без parts
            console.error('⚠️ Content has only role field, no parts.');
            console.error('Full candidate:', JSON.stringify(candidate, null, 2));
            console.error('Full response:', JSON.stringify(data, null, 2));

            // Проверяем, связана ли проблема с пустыми поисковыми запросами
            if (hasEmptyQueries || hasNoQueries) {
              throw new Error('Content structure incomplete: only role field present, no parts. The model failed to generate search queries, likely because the prompt is too vague or incomplete. Please provide a more specific research question.');
            }

            throw new Error('Content structure incomplete: only role field present, no parts. This might be a Gemini API issue with Google Search grounding. Try using a different model or check API status.');
          }
        }
      }

      // Если content пустой, но finishReason STOP - это проблема
      if (!fullText && candidate.finishReason === 'STOP') {
        if (candidate.content && Object.keys(candidate.content).length === 0) {
          console.error('⚠️ Empty content object with STOP finishReason.');
          console.error('Full candidate:', JSON.stringify(candidate, null, 2));
          throw new Error('Empty content received from Gemini API despite STOP finishReason. Please try again.');
        } else if (!candidate.content) {
          console.error('⚠️ No content field with STOP finishReason.');
          console.error('Full candidate:', JSON.stringify(candidate, null, 2));
          throw new Error('No content field in Gemini API response despite STOP finishReason. Please try again.');
        } else if (candidate.content && candidate.content.role && !candidate.content.parts) {
          // Специальный случай: content есть, но только с role, без parts
          console.error('⚠️ Content has only role field, no parts.');
          console.error('Full candidate:', JSON.stringify(candidate, null, 2));
          console.error('Full response:', JSON.stringify(data, null, 2));
          throw new Error('Content structure incomplete: only role field present, no parts. This might be a Gemini API issue with Google Search grounding. Try using a different model or check API status.');
        }
      }
    }

    console.log('📝 Extracted text length:', fullText.length);
    if (fullText.length > 0) {
      console.log('📝 First 200 chars:', fullText.slice(0, 200));
    }
    console.log('🔍 Grounding metadata:', groundingMetadata ? 'Present' : 'Not present');

    if (!fullText) {
      console.error('❌ No text in response. Full response structure:', JSON.stringify(data, null, 2));
      throw new Error('No text generated. Check logs for details about the response structure.');
    }

    // Эмулируем стриминг
    const chunkSize = 50;
    for (let i = 0; i < fullText.length; i += chunkSize) {
      if (signal?.aborted) {
        throw new Error('Aborted');
      }

      const chunk = fullText.slice(i, i + chunkSize);
      onDelta(chunk);

      await new Promise(resolve => setTimeout(resolve, 50));
    }

    console.log('✅ Generation with search completed, total length:', fullText.length);
    return { text: fullText, groundingMetadata };
  } catch (error) {
    console.error('❌ Gemini API Error:', error);
    if (signal?.aborted) {
      throw new Error('Aborted');
    }

    throw new Error(`Gemini API Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
