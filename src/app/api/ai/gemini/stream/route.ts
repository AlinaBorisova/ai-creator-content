import { NextRequest } from 'next/server';
import { streamTextViaGeminiDirect, GeminiModelVersion } from '@/lib/gemini';

export async function POST(request: NextRequest) {
  try {
    const { prompt, modelVersion = 'gemini-2.5-pro' } = await request.json();

    if (!prompt || typeof prompt !== 'string') {
      return new Response('Invalid prompt', { status: 400 });
    }

    // Валидация версии модели
    const validModelVersion: GeminiModelVersion = 
      (modelVersion === 'gemini-3-pro-preview' || modelVersion === 'gemini-2.5-pro')
        ? modelVersion
        : 'gemini-2.5-pro';

    console.log('🎯 API Route: Starting generation for prompt:', prompt.slice(0, 50));
    console.log('📌 Using model:', validModelVersion);

    const encoder = new TextEncoder();
    const abortController = new AbortController();
    
    const stream = new ReadableStream({
      async start(controller) {
        try {
          await streamTextViaGeminiDirect(
            prompt,
            (chunk: string) => {
              const data = JSON.stringify({ delta: chunk });
              controller.enqueue(encoder.encode(`${data}\n`));
            },
            abortController.signal,
            validModelVersion
          );
          
          // Отправляем сигнал завершения
          const doneData = JSON.stringify({ done: true });
          controller.enqueue(encoder.encode(`${doneData}\n`));
          controller.close();
        } catch (error) {
          console.error('❌ Stream error:', error);
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
    console.error('❌ API Route error:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}
