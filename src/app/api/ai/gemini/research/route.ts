import { NextRequest } from 'next/server';
import { streamTextViaGeminiWithSearch } from '@/lib/gemini';

export async function POST(request: NextRequest) {
  try {
    const { prompt } = await request.json();

    if (!prompt || typeof prompt !== 'string') {
      return new Response('Invalid prompt', { status: 400 });
    }

    console.log('🔍 API Route: Starting research generation for prompt:', prompt.slice(0, 50));

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
            abortController.signal
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