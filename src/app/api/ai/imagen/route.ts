import { NextRequest, NextResponse } from 'next/server';

// Функция для определения языка текста
export function detectLanguage(text: string): 'ru' | 'en' {
  // Более точная проверка на кириллические символы
  const cyrillicRegex = /[а-яёА-ЯЁ]/;
  const hasCyrillic = cyrillicRegex.test(text);

  console.log('🔍 Language detection details:', {
    text: text.slice(0, 50) + '...',
    hasCyrillic,
    detected: hasCyrillic ? 'ru' : 'en'
  });

  return hasCyrillic ? 'ru' : 'en';
}

// Функция для проверки наличия людей в промпте (универсальная для обоих языков)
export function hasPeopleInPrompt(text: string): boolean {
  const russianKeywords = ['человек', 'люди', 'мужчина', 'женщина', 'девушка', 'парень', 'ребенок', 'мальчик', 'девочка', 'портрет', 'лицо', 'персона', 'персонаж', 'модель', 'фотограф', 'фото', 'снимок'];
  const englishKeywords = ['person', 'people', 'man', 'woman', 'girl', 'boy', 'child', 'portrait', 'face', 'character', 'model', 'photographer', 'photo', 'shot', 'headshot', 'selfie', 'team', 'professional', 'business', 'owner'];

  const allKeywords = [...russianKeywords, ...englishKeywords];
  return allKeywords.some(keyword =>
    text.toLowerCase().includes(keyword.toLowerCase())
  );
}

// Функция для перевода текста с русского на английский
export async function translateToEnglish(text: string): Promise<string> {
  try {
    // Используем правильную переменную окружения
    const apiKey = process.env.GOOGLE_AI_API_KEY;

    if (!apiKey) {
      console.warn('⚠️ No API key for translation, using original text');
      return text;
    }

    console.log('🔄 Starting translation for:', text);

    // Используем правильную модель и endpoint
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `Translate the following Russian text to English for image generation. Return ONLY the English translation, nothing else: "${text}"`
            }]
          }],
          generationConfig: {
            temperature: 0.1, // Уменьшить для более стабильного перевода
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 2000, // Уменьшить, так как нужен только перевод
            stopSequences: [] // Добавить пустые стоп-последовательности
          },
          safetySettings: [ // Добавить настройки безопасности
            {
              category: "HARM_CATEGORY_HARASSMENT",
              threshold: "BLOCK_MEDIUM_AND_ABOVE"
            },
            {
              category: "HARM_CATEGORY_HATE_SPEECH", 
              threshold: "BLOCK_MEDIUM_AND_ABOVE"
            },
            {
              category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
              threshold: "BLOCK_MEDIUM_AND_ABOVE"
            },
            {
              category: "HARM_CATEGORY_DANGEROUS_CONTENT",
              threshold: "BLOCK_MEDIUM_AND_ABOVE"
            }
          ]
        })
      }
    );

    console.log('📥 Translation API response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Translation API error:', {
        status: response.status,
        error: errorText
      });
      return text;
    }

    const data = await response.json();
    console.log('📊 Translation API response:', JSON.stringify(data, null, 2));


    const translation = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    console.log('🔍 Translation result analysis:', {
      original: text,
      translation: translation,
      isDifferent: translation !== text,
      translationLength: translation?.length || 0
    });

    if (!data.candidates || data.candidates.length === 0) {
      console.error('❌ No candidates in translation response:', data);
      return text;
    }
    
    if (!data.candidates[0]?.content?.parts?.[0]?.text) {
      console.error('❌ No text content in translation response:', data);
      return text;
    }

    if (translation && translation.trim().length > 0) {
      // Проверяем, что перевод действительно отличается от оригинала
      if (translation.trim() !== text.trim()) {
        console.log('✅ Translation successful:', {
          original: text.slice(0, 50) + '...',
          translated: translation.slice(0, 50) + '...'
        });
        return translation;
      } else {
        console.log('⚠️ Translation returned same text as original');
        return text;
      }
    } else {
      console.warn('⚠️ Translation returned invalid result, using original text');
      return text;
    }
  } catch (error) {
    console.error('💥 Translation error:', error);
    return text;
  }
}

// Функция для добавления подсказок славянской внешности
export function addSlavicPrompts(text: string): string {
  if (hasPeopleInPrompt(text)) {
    console.log('👥 People detected in prompt, adding Slavic appearance prompts');
    return `${text}, Slavic features, Eastern European appearance, light skin, light eyes, straight nose, round face, soft features`;
  }

  return text;
}

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 Imagen API endpoint called');

    const body = await request.json();
    console.log('📝 Request body:', body);

    const { prompt, numberOfImages = 1, imageSize = '1K', aspectRatio = '1:1', modelVersion = 'imagen-4.0-generate-001' } = body;

    if (!prompt) {
      console.error('❌ No prompt provided');
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    console.log('🎨 Image generation parameters:', {
      prompt: prompt.slice(0, 50) + '...',
      numberOfImages,
      imageSize,
      aspectRatio,
      modelVersion
    });

    const apiKey = process.env.GOOGLE_AI_API_KEY;
    console.log('🔑 API Key check:', {
      exists: !!apiKey,
      length: apiKey?.length || 0,
      startsWith: apiKey?.substring(0, 10) || 'N/A',
      usingGoogleAI: !!process.env.GOOGLE_AI_API_KEY
    });

    if (!apiKey) {
      console.error('❌ API key not configured');
      return NextResponse.json({
        error: 'API key not configured. Please check your .env.local file'
      }, { status: 500 });
    }

    // Определяем язык и переводим при необходимости
    const language = detectLanguage(prompt);
    console.log('🌐 Language detected:', language);

    let finalPrompt = prompt;
    let wasTranslated = false;

    // Переводим только если текст на русском
    if (language === 'ru') {
      console.log('🔄 Translating Russian prompt to English...');
      const translation = await translateToEnglish(prompt);
      console.log('🔄 Translation result:', {
        original: prompt,
        translated: translation,
        isDifferent: translation !== prompt
      });

      if (translation !== prompt) {
        finalPrompt = translation;
        wasTranslated = true;
        console.log('✅ Translation successful');
      } else {
        console.log('⚠️ Translation returned same text');
      }
    } else {
      console.log('✅ Prompt is already in English');
    }

    // Проверяем наличие людей и добавляем славянские подсказки
    const hasPeople = hasPeopleInPrompt(finalPrompt);
    console.log('👥 People detected in final prompt:', hasPeople);

    if (hasPeople) {
      const beforeSlavic = finalPrompt;
      finalPrompt = addSlavicPrompts(finalPrompt);
      console.log('🇷🇺 Slavic prompts added:', finalPrompt !== beforeSlavic);
    }

    console.log('🎨 Final processing result:', {
      originalPrompt: prompt.slice(0, 50) + '...',
      finalPrompt: finalPrompt.slice(0, 50) + '...',
      language,
      wasTranslated,
      hasPeople,
      hasSlavicPrompts: hasPeople,
      numberOfImages,
      imageSize,
      aspectRatio
    });

    const requestBody = {
      instances: [
        {
          prompt: finalPrompt
        }
      ],
      parameters: {
        sampleCount: numberOfImages,
        imageSize: imageSize,
        aspectRatio: aspectRatio,
        personGeneration: 'allow_adult'
      }
    };

    console.log('📤 Sending request to Imagen API:', JSON.stringify(requestBody, null, 2));

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelVersion}:predict`,
      {
        method: 'POST',
        headers: {
          'x-goog-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      }
    );

    console.log('📥 Imagen API response status:', response.status);

    if (!response.ok) {
      const errorData = await response.text();
      console.error('❌ Imagen API error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorData
      });

      return NextResponse.json({
        error: 'Failed to generate images',
        status: response.status,
        details: errorData
      }, { status: response.status });
    }

    const data = await response.json();
    console.log('✅ Imagen API response received');

    // ИСПРАВЛЕНИЕ: Правильно извлекаем изображения из ответа
    const predictions = data.predictions || [];
    console.log('🔍 Predictions found:', predictions.length);

    if (predictions.length === 0) {
      console.warn('⚠️ No predictions returned');
      return NextResponse.json({
        success: true,
        images: [],
        message: 'No predictions were returned'
      });
    }

    // Преобразуем predictions в формат изображений
    const images = predictions.map((prediction: {
      bytesBase64Encoded?: string;
      mimeType?: string;
    }, index: number) => {
      console.log(`🖼️ Processing prediction ${index + 1}:`, {
        hasBytes: !!prediction.bytesBase64Encoded,
        hasMimeType: !!prediction.mimeType,
        bytesLength: prediction.bytesBase64Encoded?.length || 0
      });

      return {
        imageBytes: prediction.bytesBase64Encoded,
        mimeType: prediction.mimeType || 'image/png',
        index: index + 1
      };
    });

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

// Обработка OPTIONS запросов для CORS
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