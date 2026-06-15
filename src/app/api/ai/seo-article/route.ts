import { NextRequest, NextResponse } from 'next/server';
import { streamTextViaGeminiDirect, GeminiModelVersion } from '@/lib/gemini';
import { applyRateLimit } from '@/lib/rateLimit/middleware';

export async function POST(request: NextRequest) {
  try {
    // Проверка rate limit
    const rateLimitResponse = await applyRateLimit(request, 'AI_SEO_ARTICLE');
    if (rateLimitResponse) {
      return rateLimitResponse;
    }
    const { prompt, topic, searchQuery, modelVersion = 'gemini-2.5-pro' } = await request.json();

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    // Валидация версии модели
    const validModelVersion: GeminiModelVersion = 
      (modelVersion === 'gemini-2.5-flash' || modelVersion === 'gemini-2.5-pro')
        ? modelVersion
        : 'gemini-2.5-pro';

    console.log('📌 Using model:', validModelVersion);

    // Формируем финальный промпт с инструкциями для SEO-статьи
    const seoPrompt = `Ты копирайтер. Напиши текст по теме: [${topic || 'указанная тема'}], используя Pyramid Principle. Начни с главной идеи или вывода, затем предоставь аргументы или причины, поддерживающие твою главную идею, и заверши деталями или примерами и правила LSI-копирайтинг (Latent Semantic Indexing) на 5000-12000 символов, уникальностью более 90% с соблюдением закона Ципфа, Чтобы он вышел в ТОП 10 Яндекс и Гугл по запросу: [${searchQuery || 'указанный запрос'}]. Избегай переспама ключевых запросов и других правил, которые понижают контент в поисковой выдаче Яндекс и Гугл.

${prompt}

Укажи места в тексте где поставить тематическое изображение для удобного просмотра текста, напиши промты в стиле фотореалистичного изображения (без схем, метафор и символизма) для ideogram для этих изображений.

Напиши текст в HTML тегах, которые указаны ниже, порядок определи сам, для быстрой установки на страницу сайта. Вместо тега <strong> используй <span> с классом "text-bold". Отформатируй текст по правилам типографики.

ВАЖНО - используй классы, которые указаны в промпте пользователя. Если в промпте указаны классы (например: seo__content-images, seo__title, stati__img и т.д.), используй именно их.

Для каждого изображения используй специальный формат с обязательными атрибутами data-image-prompt и data-image-count:

<div class="НАЗВАНИЕ_КЛАССА_ИЗ_ПРОМПТА" data-image-prompt="ПРОМПТ_ДЛЯ_ИЗОБРАЖЕНИЯ" data-image-count="1">
     <!-- Изображение будет вставлено здесь -->
</div>

ИЛИ для двух изображений:

<div class="НАЗВАНИЕ_КЛАССА_ИЗ_ПРОМПТА" data-image-prompt="ПРОМПТ_ДЛЯ_ИЗОБРАЖЕНИЯ" data-image-count="2">
     <!-- Изображения будут вставлены здесь -->
</div>

КРИТИЧЕСКИ ВАЖНО:
- ВСЕГДА анализируй промпт пользователя на наличие указаний о количестве изображений
- Если в промпте есть фразы "по 2", "два изображения", "2 изображения", "по два" - ОБЯЗАТЕЛЬНО используй data-image-count="2"
- Если в примере показан блок с двумя тегами <img> - используй data-image-count="2"
- Если количество не указано явно - используй data-image-count="1"
- В атрибуте data-image-prompt указывай промпт для генерации изображения на английском языке
- В атрибуте data-image-count указывай ТОЧНОЕ количество изображений (1 или 2) в зависимости от указаний в промпте
- В атрибуте class используй ТОЧНО тот класс, который указан в промпте пользователя (stati__img, seo__content-images и т.д.)
- Промпт должен быть фотореалистичным, без схем и метафор
- Используй понятные описания для ideogram`;

    const encoder = new TextEncoder();
    const abortController = new AbortController();

    const stream = new ReadableStream({
      async start(controller) {
        try {
          await streamTextViaGeminiDirect(
            seoPrompt,
            (chunk: string) => {
              const data = JSON.stringify({ delta: chunk });
              controller.enqueue(encoder.encode(`${data}\n`));
            },
            abortController.signal,
            validModelVersion
          );

          const doneData = JSON.stringify({ done: true });
          controller.enqueue(encoder.encode(`${doneData}\n`));
          controller.close();
        } catch (error) {
          console.error('❌ SEO Article stream error:', error);
          const errorData = JSON.stringify({
            error: error instanceof Error ? error.message : 'Unknown error'
          });
          controller.enqueue(encoder.encode(`${errorData}\n`));
          controller.close();
        }
      },
      cancel() {
        abortController.abort();
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('❌ SEO Article API Route error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}