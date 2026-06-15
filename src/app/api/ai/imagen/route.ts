import { NextRequest, NextResponse } from 'next/server';
import { imagenRequestSchema } from '@/lib/validations/schemas';
import { validateRequest } from '@/lib/validations/validator';
import { applyRateLimit } from '@/lib/rateLimit/middleware';
import { VertexAI } from '@google-cloud/vertexai';
import { GoogleAuth } from 'google-auth-library';

// --- Инициализация Google Cloud ---
const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
const location = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';
const client_email = process.env.GOOGLE_CLOUD_CLIENT_EMAIL;
const private_key = process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n');

// Функция для определения языка текста
export function detectLanguage(text: string): 'ru' | 'en' {
  const cyrillicRegex = /[а-яёА-ЯЁ]/;
  const hasCyrillic = cyrillicRegex.test(text);
  return hasCyrillic ? 'ru' : 'en';
}

// Функция для проверки наличия людей в промпте
export function hasPeopleInPrompt(text: string): boolean {
  const russianKeywords = ['человек', 'люди', 'мужчина', 'женщина', 'девушка', 'парень', 'ребенок', 'мальчик', 'девочка', 'портрет', 'лицо', 'персона', 'персонаж', 'модель', 'фотограф', 'фото', 'снимок'];
  const englishKeywords = ['person', 'people', 'man', 'woman', 'girl', 'boy', 'child', 'portrait', 'face', 'character', 'model', 'photographer', 'photo', 'shot', 'headshot', 'selfie', 'team', 'professional', 'business', 'owner'];
  const allKeywords = [...russianKeywords, ...englishKeywords];
  return allKeywords.some(keyword => text.toLowerCase().includes(keyword.toLowerCase()));
}

// Перевод через Vertex AI
export async function translateToEnglish(text: string): Promise<string> {
  try {
    if (!projectId || !client_email || !private_key) {
      console.warn('⚠️ No Google Cloud credentials, skipping translation');
      return text;
    }

    const vertexAI = new VertexAI({
      project: projectId,
      location: location,
      googleAuthOptions: { credentials: { client_email, private_key } }
    });

    const generativeModel = vertexAI.getGenerativeModel({ model: 'gemini-2.5-pro' });
    const promptText = `Translate the following Russian text to English for image generation. Return ONLY the English translation, nothing else: "${text}"`;

    const resp = await generativeModel.generateContent({
      contents: [{ role: 'user', parts: [{ text: promptText }] }],
      generationConfig: {
        temperature: 0.1,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 2000,
      }
    });

    const translation = resp.response.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    
    if (translation && translation !== text.trim()) {
      return translation;
    }
    return text;
  } catch (error) {
    console.error('💥 Translation error:', error);
    return text;
  }
}

export function addSlavicPrompts(text: string): string {
  if (hasPeopleInPrompt(text)) {
    return `${text}, Slavic features, Eastern European appearance, light skin, light eyes, straight nose, round face, soft features`;
  }
  return text;
}

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 Imagen Vertex AI endpoint called');

    const rateLimitResponse = await applyRateLimit(request, 'AI_IMAGE');
    if (rateLimitResponse) return rateLimitResponse;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const validation = await validateRequest(imagenRequestSchema, body);
    if (!validation.success) return validation.response;

    const { prompt, numberOfImages, imageSize, aspectRatio, modelVersion } = validation.data;

    if (!projectId || !client_email || !private_key) {
      return NextResponse.json({ error: 'Google Cloud credentials not configured in .env' }, { status: 500 });
    }

    const language = detectLanguage(prompt);
    let finalPrompt = prompt;
    let wasTranslated = false;

    if (language === 'ru') {
      const translation = await translateToEnglish(prompt);
      if (translation !== prompt) {
        finalPrompt = translation;
        wasTranslated = true;
      }
    }

    const hasPeople = hasPeopleInPrompt(finalPrompt);
    if (hasPeople) {
      finalPrompt = addSlavicPrompts(finalPrompt);
    }

    // --- Авторизация Vertex AI (получаем Bearer Token) ---
    const auth = new GoogleAuth({
      credentials: { client_email, private_key },
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    });
    const client = await auth.getClient();
    const accessToken = await client.getAccessToken();

    // Формируем URL для Vertex AI
    const vertexUrl = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${modelVersion}:predict`;

    const requestBody = {
      instances: [{ prompt: finalPrompt }],
      parameters: {
        sampleCount: numberOfImages,
        aspectRatio: aspectRatio,
        // В Vertex AI параметр пишется заглавными буквами
        personGeneration: 'ALLOW_ADULT' 
      }
    };

    console.log('📤 Sending request to Vertex Imagen:', vertexUrl);

    const response = await fetch(vertexUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken.token}`,
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('❌ Imagen API error:', errorData);
      
      let errorMessage = 'Failed to generate images';
      try {
        const parsedError = JSON.parse(errorData);
        if (parsedError.error?.message) errorMessage = parsedError.error.message;
      } catch {}

      return NextResponse.json({
        error: errorMessage,
        status: response.status,
        details: errorData
      }, { status: response.status });
    }

    const data = await response.json();
    const predictions = data.predictions || [];

    if (predictions.length === 0) {
      return NextResponse.json({ success: true, images: [], message: 'No predictions returned' });
    }

    const images = predictions.map((prediction: any, index: number) => ({
      imageBytes: prediction.bytesBase64Encoded,
      mimeType: prediction.mimeType || 'image/png',
      index: index + 1
    }));

    return NextResponse.json({
      success: true,
      images: images,
      count: images.length,
      translation: {
        original: prompt,
        translated: finalPrompt,
        language: language,
        wasTranslated: wasTranslated,
        hasSlavicPrompts: hasPeople
      }
    });

  } catch (error) {
    console.error('💥 Imagen generation error:', error);
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
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}