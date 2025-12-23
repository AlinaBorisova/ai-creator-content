import { NextRequest, NextResponse } from 'next/server';
import { detectLanguage, hasPeopleInPrompt, translateToEnglish, addSlavicPrompts } from '@/app/api/ai/imagen/route';
import { veoRequestSchema } from '@/lib/validations/schemas';
import { validateRequest } from '@/lib/validations/validator';
import { applyRateLimit } from '@/lib/rateLimit/middleware';

export async function POST(request: NextRequest) {
  try {
    console.log('🎬 Veo API endpoint called');

    // Проверка rate limit
    const rateLimitResponse = await applyRateLimit(request, 'AI_VIDEO');
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    // Парсим и валидируем тело запроса
    let body: unknown;
    try {
      body = await request.json();
      console.log('📝 Request body:', body);
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    // Валидация входных данных
    const validation = await validateRequest(veoRequestSchema, body);
    
    if (!validation.success) {
      return validation.response;
    }

    const {
      prompt,
      referenceImages,
      modelVersion,
      durationSeconds,
      aspectRatio,
      resolution
    } = validation.data;

    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
      console.error('❌ API key not configured');
      return NextResponse.json({
        error: 'API key not configured. Please check your .env.local file'
      }, { status: 500 });
    }

    // Определяем язык и переводим при необходимости
    const language = detectLanguage(prompt);
    let finalPrompt = prompt;
    let wasTranslated = false;

    if (language === 'ru') {
      console.log('🔄 Translating Russian prompt to English...');
      const translation = await translateToEnglish(prompt);
      if (translation !== prompt) {
        finalPrompt = translation;
        wasTranslated = true;
      }
    }

    // Проверяем наличие людей и добавляем славянские подсказки
    const hasPeople = hasPeopleInPrompt(finalPrompt);
    if (hasPeople) {
      finalPrompt = addSlavicPrompts(finalPrompt);
    }

    console.log('🎬 Final processing result:', {
      originalPrompt: prompt.slice(0, 50) + '...',
      finalPrompt: finalPrompt.slice(0, 50) + '...',
      language,
      wasTranslated,
      hasPeople,
      referenceImagesCount: referenceImages.length
    });

    // Подготавливаем референсные изображения
    const processedImages = await Promise.all(
      referenceImages.map(async (img: { file: string; name: string; size: number }) => {
        // Конвертируем base64 в нужный формат для API
        const base64Data = img.file.split(',')[1];
        return {
          mimeType: img.file.split(',')[0].split(':')[1].split(';')[0],
          data: base64Data
        };
      })
    );

    // ✅ ИСПРАВЛЕННАЯ структура запроса согласно документации
    const requestBody = {
      instances: [{
        prompt: finalPrompt,
        ...(processedImages.length > 0 && {
          image: processedImages[0] // Veo поддерживает одно референсное изображение
        })
      }]
      // ❌ УБРАНО поле "config" - оно не поддерживается API
    };

    console.log('📤 Sending request to Veo API:', JSON.stringify(requestBody, null, 2));
    console.log('🔗 URL:', `https://generativelanguage.googleapis.com/v1beta/models/${modelVersion}:predictLongRunning`);
    console.log('🎯 Модель:', modelVersion);
    console.log('⏱️ Длительность:', durationSeconds, 'секунд');
    console.log('📐 Соотношение сторон:', aspectRatio);
    console.log('📺 Разрешение:', resolution);
    console.log('🖼️ Референсные изображения:', processedImages.length > 0 ? `${processedImages.length} изображений` : 'Нет');
    console.log('📝 Финальный промпт:', finalPrompt);

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelVersion}:predictLongRunning?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Veo API error:', {
        status: response.status,
        error: errorText
      });
      return NextResponse.json({ error: 'Failed to generate video' }, { status: response.status });
    }

    const data = await response.json();
    console.log('📊 Veo API response:', JSON.stringify(data, null, 2));

    // Возвращаем операцию для polling
    return NextResponse.json({
      success: true,
      operation: data.name,
      translation: {
        original: prompt,
        translated: finalPrompt,
        language: language,
        wasTranslated: wasTranslated,
        hasSlavicPrompts: hasPeople
      }
    });

  } catch (error) {
    console.error('💥 Veo generation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}