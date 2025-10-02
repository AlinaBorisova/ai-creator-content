import { NextResponse } from 'next/server';

// ========================================================================
// 1. ПАРСИНГ ПОСТА ИЗ TELEGRAM (ВРЕМЕННАЯ ЗАГЛУШКА)
// ========================================================================
async function parseTelegramPost(url: string): Promise<string> {
  console.log('!!! USING MOCKED TELEGRAM RESPONSE !!! Parsing URL:', url);
  return "Google представила Gemini 1.5 Pro — новую версию своей флагманской модели. Ключевая особенность — огромное контекстное окно в 1 миллион токенов, что позволяет анализировать целые книги или многочасовые видео. Модель также демонстрирует прорывные способности в мультимодальном понимании и решении сложных задач.";
}

// ========================================================================
// 2. РЕРАЙТ ТЕКСТА С ПОМОЩЬЮ YANDEX GPT (НОВАЯ ВЕРСИЯ)
// ========================================================================
async function generateRewrittenText(originalText: string): Promise<string> {
  console.log('Rewriting text with YandexGPT...');
  const body = {
    modelUri: `gpt://${process.env.YANDEX_FOLDER_ID}/yandexgpt-lite`,
    completionOptions: {
      stream: false,
      temperature: 0.6,
      maxTokens: '2000',
    },
    messages: [
      {
        role: 'system',
        text: 'Ты — опытный SMM-менеджер. Твоя задача — переписать текст для поста в социальной сети. Сделай его интересным, кратким и добавь подходящие по смыслу эмодзи. Сохрани ключевую информацию.',
      },
      {
        role: 'user',
        text: originalText,
      },
    ],
  };

  const response = await fetch('https://llm.api.cloud.yandex.net/foundationModels/v1/completion', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Api-Key ${process.env.YANDEX_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`YandexGPT text rewrite failed: ${errorText}`);
  }

  const data = await response.json();
  return data.result.alternatives[0].message.text;
}

// ========================================================================
// 3. ГЕНЕРАЦИЯ ПРОМТА ДЛЯ ИЗОБРАЖЕНИЯ С YANDEX GPT (НОВАЯ ВЕРСИЯ)
// ========================================================================
async function generateImagePrompt(rewrittenText: string): Promise<string> {
  console.log('Generating image prompt with YandexGPT...');
  const body = {
    modelUri: `gpt://${process.env.YANDEX_FOLDER_ID}/yandexgpt-lite`,
    completionOptions: {
      stream: false,
      temperature: 0.7,
      maxTokens: '200',
    },
    messages: [
      {
        role: 'system',
        text: 'Твоя задача — на основе текста для поста создать короткий, описательный промт для нейросети, генерирующей изображения. Промт должен быть на английском языке, в стиле photorealistic или cinematic, и очень ярким визуально.',
      },
      {
        role: 'user',
        text: rewrittenText,
      },
    ],
  };

  const response = await fetch('https://llm.api.cloud.yandex.net/foundationModels/v1/completion', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Api-Key ${process.env.YANDEX_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`YandexGPT image prompt generation failed: ${errorText}`);
  }

  const data = await response.json();
  return data.result.alternatives[0].message.text;
}

// ========================================================================
// 4. ГЕНЕРАЦИЯ ИЗОБРАЖЕНИЯ (ЗАГЛУШКА, ОСТАЕТСЯ БЕЗ ИЗМЕНЕНИЙ)
// ========================================================================
async function generateImageWithImagen(prompt: string): Promise<string> {
  console.log('--- MOCK IMAGE GENERATION ---');
  console.log('Using placeholder service instead of Imagen. Prompt:', prompt);
  const encodedPrompt = encodeURIComponent(prompt);
  return `https://avatars.mds.yandex.net/get-sprav-products/2701203/2a00000190a9f23e162fcddd6a72ac230cf7/M_height?text=${encodedPrompt}`;
}


// ========================================================================
// ОСНОВНОЙ ОБРАБОТЧИК API-ЗАПРОСА (ОСТАЕТСЯ БЕЗ ИЗМЕНЕНИЙ)
// ========================================================================
export async function POST(request: Request) {
  try {
    const { postUrl } = await request.json();
    if (!postUrl) {
      return NextResponse.json({ error: 'postUrl is required' }, { status: 400 });
    }

    const originalText = await parseTelegramPost(postUrl);
    const rewrittenText = await generateRewrittenText(originalText);
    const imagePrompt = await generateImagePrompt(rewrittenText);
    const imageUrl = await generateImageWithImagen(imagePrompt);

    return NextResponse.json({
      originalText,
      rewrittenText,
      imagePrompt,
      imageUrl,
    });

  } catch (error) {
    console.error('--- ERROR IN PIPELINE ---', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
