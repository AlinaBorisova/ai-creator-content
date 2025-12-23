import { NextRequest } from 'next/server';
import { streamTextViaGeminiWithSearch, GeminiModelVersion } from '@/lib/gemini';
import { geminiResearchRequestSchema } from '@/lib/validations/schemas';
import { validateRequest } from '@/lib/validations/validator';

export async function POST(request: NextRequest) {
  try {
    // Парсим и валидируем тело запроса
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON in request body' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Валидация входных данных
    const validation = await validateRequest(geminiResearchRequestSchema, body);
    
    if (!validation.success) {
      const errorData = await validation.response.json();
      return new Response(JSON.stringify({
        error: 'Validation failed',
        details: errorData
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { prompt, modelVersion } = validation.data;
    const validModelVersion: GeminiModelVersion = modelVersion;

    console.log('🔍 API Route: Starting research generation for prompt:', prompt.slice(0, 50));
    console.log('📌 Using model:', validModelVersion);

    const encoder = new TextEncoder();
    const abortController = new AbortController();

    const stream = new ReadableStream({
      async start(controller) {
        try {
          const result = await streamTextViaGeminiWithSearch(
            prompt,
            (chunk: string) => {
              const data = JSON.stringify({ delta: chunk });
              controller.enqueue(encoder.encode(`${data}\n`));
            },
            abortController.signal,
            validModelVersion
          );

          // Отправляем метаданные grounding
          if (result.groundingMetadata) {
            const metadataData = JSON.stringify({
              groundingMetadata: result.groundingMetadata
            });
            controller.enqueue(encoder.encode(`${metadataData}\n`));
          }

          // Отправляем сигнал завершения
          const doneData = JSON.stringify({ done: true });
          controller.enqueue(encoder.encode(`${doneData}\n`));
          controller.close();
        } catch (error) {
          console.error('❌ Research stream error:', error);
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
    console.error('❌ Research API Route error:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}