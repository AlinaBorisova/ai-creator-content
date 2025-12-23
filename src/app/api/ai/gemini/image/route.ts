import { NextRequest, NextResponse } from 'next/server';
import { geminiImageRequestSchema } from '@/lib/validations/schemas';
import { validateRequest } from '@/lib/validations/validator';

// Функции для определения языка и перевода (можно скопировать из imagen/route.ts)
export function detectLanguage(text: string): 'ru' | 'en' {
  const cyrillicRegex = /[а-яёА-ЯЁ]/;
  const hasCyrillic = cyrillicRegex.test(text);
  return hasCyrillic ? 'ru' : 'en';
}

export async function translateToEnglish(text: string): Promise<string> {
  try {
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
      console.warn('⚠️ No API key for translation, using original text');
      return text;
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `Translate the following Russian text to English for image generation. Return ONLY the English translation, nothing else: "${text}"`
            }]
          }],
          generationConfig: {
            temperature: 0.1,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 2000
          }
        })
      }
    );

    if (!response.ok) {
      return text;
    }

    const data = await response.json();
    const translation = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    return translation || text;
  } catch (error) {
    console.error('Translation error:', error);
    return text;
  }
}

// Маппинг соотношений сторон на разрешения для разных размеров
const getResolutionForAspectRatio = (aspectRatio: string, resolution: '1K' | '2K' | '4K') => {
  const resolutions: Record<string, Record<'1K' | '2K' | '4K', { width: number; height: number }>> = {
    '1:1': { '1K': { width: 1024, height: 1024 }, '2K': { width: 2048, height: 2048 }, '4K': { width: 4096, height: 4096 } },
    '2:3': { '1K': { width: 848, height: 1264 }, '2K': { width: 1696, height: 2528 }, '4K': { width: 3392, height: 5056 } },
    '3:2': { '1K': { width: 1264, height: 848 }, '2K': { width: 2528, height: 1696 }, '4K': { width: 5056, height: 3392 } },
    '3:4': { '1K': { width: 896, height: 1200 }, '2K': { width: 1792, height: 2400 }, '4K': { width: 3584, height: 4800 } },
    '4:3': { '1K': { width: 1200, height: 896 }, '2K': { width: 2400, height: 1792 }, '4K': { width: 4800, height: 3584 } },
    '4:5': { '1K': { width: 928, height: 1152 }, '2K': { width: 1856, height: 2304 }, '4K': { width: 3712, height: 4608 } },
    '5:4': { '1K': { width: 1152, height: 928 }, '2K': { width: 2304, height: 1856 }, '4K': { width: 4608, height: 3712 } },
    '9:16': { '1K': { width: 768, height: 1376 }, '2K': { width: 1536, height: 2752 }, '4K': { width: 3072, height: 5504 } },
    '16:9': { '1K': { width: 1376, height: 768 }, '2K': { width: 2752, height: 1536 }, '4K': { width: 5504, height: 3072 } },
    '21:9': { '1K': { width: 1584, height: 672 }, '2K': { width: 3168, height: 1344 }, '4K': { width: 6336, height: 2688 } }
  };

  return resolutions[aspectRatio]?.[resolution] || resolutions['1:1'][resolution];
};

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 Gemini Image API endpoint called');

    // Парсим и валидируем тело запроса
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    // Валидация входных данных
    const validation = await validateRequest(geminiImageRequestSchema, body);
    
    if (!validation.success) {
      return validation.response;
    }

    const { prompt, aspectRatio, resolution } = validation.data;

    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        error: 'API key not configured. Please check your .env.local file'
      }, { status: 500 });
    }

    // Определяем язык и переводим при необходимости
    const language = detectLanguage(prompt);
    let finalPrompt = prompt;
    let wasTranslated = false;

    if (language === 'ru') {
      finalPrompt = await translateToEnglish(prompt);
      wasTranslated = finalPrompt !== prompt;
    }

    // Получаем разрешение для выбранного соотношения сторон
    const { width, height } = getResolutionForAspectRatio(aspectRatio, resolution);

    // Формируем запрос к Gemini Image API
    const requestBody = {
      contents: [{
        parts: [{ text: finalPrompt }]
      }],
      generationConfig: {
        responseModalities: ['IMAGE'],
        // Для Nano Banana PRO можно указать разрешение через параметры
      }
    };

    console.log('📤 Sending request to Gemini Image API:', {
      model: 'gemini-3-pro-image-preview',
      aspectRatio,
      resolution,
      width,
      height
    });

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      }
    );

    if (!response.ok) {
      const errorData = await response.text();
      console.error('❌ Gemini Image API error:', {
        status: response.status,
        error: errorData
      });

      let errorMessage = 'Failed to generate images';
      try {
        const parsedError = JSON.parse(errorData);
        if (parsedError.error?.message) {
          errorMessage = parsedError.error.message;
        }
      } catch {
        // Если не JSON, используем как есть
      }

      return NextResponse.json({
        error: errorMessage,
        status: response.status
      }, { status: response.status });
    }

    const data = await response.json();
    console.log('✅ Gemini Image API response received');

    // Извлекаем изображения из ответа
    const images: Array<{ imageBytes: string; mimeType: string; index: number }> = [];

    if (data.candidates && data.candidates.length > 0) {
      const candidate = data.candidates[0];
      if (candidate.content && candidate.content.parts) {
        candidate.content.parts.forEach((part: { inlineData?: { mimeType?: string; data: string } }, index: number) => {
          if (part.inlineData) {
            images.push({
              imageBytes: part.inlineData.data,
              mimeType: part.inlineData.mimeType || 'image/png',
              index: index + 1
            });
          }
        });
      }
    }

    if (images.length === 0) {
      return NextResponse.json({
        success: true,
        images: [],
        message: 'No images were returned'
      });
    }

    console.log(`🎉 Successfully processed ${images.length} images`);

    return NextResponse.json({
      success: true,
      images: images,
      count: images.length,
      translation: {
        original: prompt,
        translated: finalPrompt,
        language: language,
        wasTranslated: wasTranslated,
        hasSlavicPrompts: false
      }
    });

  } catch (error) {
    console.error('💥 Gemini Image generation error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}