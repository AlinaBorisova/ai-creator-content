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
    const timeoutId = setTimeout(() => timeoutController.abort(), 120000); // 120 секунд таймаут

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
        if (candidate.content && candidate.content.parts && candidate.content.parts.length > 0) {
          fullText = candidate.content.parts[0].text || '';
        }
      }

      console.log('📝 Extracted text length:', fullText.length);
      console.log('📝 First 100 chars:', fullText.slice(0, 100));

      if (!fullText) {
        console.error('❌ No text in response:', data);
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
      if (candidate.content && candidate.content.parts && candidate.content.parts.length > 0) {
        fullText = candidate.content.parts[0].text || '';
      }
      if (candidate.groundingMetadata) {
        groundingMetadata = candidate.groundingMetadata as GroundingMetadata;
      }
    }

    console.log('📝 Extracted text length:', fullText.length);
    console.log('🔍 Grounding metadata:', groundingMetadata ? 'Present' : 'Not present');

    if (!fullText) {
      console.error('❌ No text in response:', data);
      throw new Error('No text generated');
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
