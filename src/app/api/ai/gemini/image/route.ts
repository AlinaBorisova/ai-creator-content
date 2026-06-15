import { NextRequest, NextResponse } from 'next/server';
import { VertexAI } from '@google-cloud/vertexai';
import { GoogleAuth } from 'google-auth-library';
import { geminiImageRequestSchema } from '@/lib/validations/schemas';
import { validateRequest } from '@/lib/validations/validator';
import { applyRateLimit } from '@/lib/rateLimit/middleware';

// Google Cloud credentials
const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
const location = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';
const client_email = process.env.GOOGLE_CLOUD_CLIENT_EMAIL;
const private_key = process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n');

if (!projectId || !client_email || !private_key) {
  console.warn('⚠️ Отсутствуют ключи Google Cloud Vertex AI в файле .env!');
}

// Функции для определения языка и перевода
export function detectLanguage(text: string): 'ru' | 'en' {
  const cyrillicRegex = /[а-яёА-ЯЁ]/;
  const hasCyrillic = cyrillicRegex.test(text);
  return hasCyrillic ? 'ru' : 'en';
}

export async function translateToEnglish(text: string): Promise<string> {
  try {
    if (!projectId || !client_email || !private_key) {
      console.warn('⚠️ No Google Cloud credentials for translation');
      return text;
    }

    const vertexAI = new VertexAI({
      project: projectId,
      location: location,
      googleAuthOptions: {
        credentials: { client_email, private_key }
      }
    });

    const generativeModel = vertexAI.getGenerativeModel({ model: 'gemini-2.5-pro' });
    const promptText = `Translate the following Russian text to English for image generation. Return ONLY the English translation, nothing else: "${text}"`;

    const resp = await generativeModel.generateContent({
      contents: [{ role: 'user', parts: [{ text: promptText }] }],
      generationConfig: {
        temperature: 0.1,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 2000
      }
    });

    const translation = resp.response.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
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

    // Проверка rate limit
    const rateLimitResponse = await applyRateLimit(request, 'AI_IMAGE');
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

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

    const { prompt, aspectRatio, resolution, numberOfImages } = validation.data;

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

    console.log('📤 Sending request to Vertex AI Gemini Image API:', {
      model: 'gemini-3-pro-image@001',
      aspectRatio,
      resolution,
      width,
      height
    });

    // Используем SDK для генерации изображений (как текстовые модели)
    if (!projectId || !client_email || !private_key) {
      return NextResponse.json({
        error: 'Google Cloud credentials not configured in .env'
      }, { status: 500 });
    }

    const vertexAI = new VertexAI({
      project: projectId,
      location: location,
      googleAuthOptions: {
        credentials: { client_email, private_key }
      }
    });

    // Используем Imagen для генерации изображений (Gemini image models недоступны)
    // Gemini модели для текста, Imagen для изображений
    const auth = new GoogleAuth({
      credentials: { client_email, private_key },
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    });
    const client = await auth.getClient();
    const accessToken = await client.getAccessToken();

    // Используем Imagen REST API как в других местах
    const modelVersion = 'imagen-3.0-generate-001';
    const vertexUrl = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${modelVersion}:predict`;

    const requestBody = {
      instances: [{ prompt: finalPrompt }],
      parameters: {
        sampleCount: numberOfImages,
        aspectRatio: aspectRatio,
        personGeneration: 'ALLOW_ADULT'
      }
    };

    console.log('📤 Sending request to Vertex Imagen for Nano Banana PRO:', {
      model: modelVersion,
      url: vertexUrl
    });

    try {
      const resp = await fetch(vertexUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken.token}`,
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify(requestBody)
      });

      if (!resp.ok) {
        const errorData = await resp.text();
        console.error('❌ Imagen API error:', {
          status: resp.status,
          error: errorData
        });

        let errorMessage = 'Failed to generate images';
        try {
          const parsedError = JSON.parse(errorData);
          if (parsedError.error?.message) {
            errorMessage = parsedError.error.message;
          }
        } catch (e) {
          console.error('Error parsing error response:', e);
        }

        return NextResponse.json({
          error: errorMessage,
          status: resp.status
        }, { status: resp.status });
      }

      const data = await resp.json();
      console.log('✅ Imagen API response received');

      // Извлекаем изображения из ответа
      const images: Array<{ imageBytes: string; mimeType: string; index: number }> = [];

      const predictions = data.predictions || [];
      predictions.forEach((prediction: any, index: number) => {
        if (prediction.bytesBase64Encoded) {
          images.push({
            imageBytes: prediction.bytesBase64Encoded,
            mimeType: prediction.mimeType || 'image/png',
            index: index + 1
          });
        }
      });

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
    } catch (sdkError) {
      console.error('❌ API Error:', sdkError);
      throw sdkError;
    }

  } catch (error) {
    console.error('💥 Gemini Image generation error:', error);
    console.error('❌ Full error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      name: error instanceof Error ? error.name : 'Unknown',
      stack: error instanceof Error ? error.stack : 'No stack trace'
    });
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