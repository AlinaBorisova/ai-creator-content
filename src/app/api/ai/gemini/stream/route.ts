import { NextRequest } from 'next/server';
import { streamTextViaGeminiDirect } from '@/lib/gemini';

export async function POST(request: NextRequest) {
  try {
    const { prompt } = await request.json();

    if (!prompt || typeof prompt !== 'string') {
      return new Response('Invalid prompt', { status: 400 });
    }

    console.log('🎯 API Route: Starting generation for prompt:', prompt.slice(0, 50));

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
            abortController.signal
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

// import { streamTextViaGenApi } from "@/lib/gemini";

// const encoder = new TextEncoder();

// export async function POST(req: Request) {
//   const { prompt } = await req.json().catch(() => ({}));
//   if (!prompt || typeof prompt !== 'string' || prompt.trim().length < 5 || prompt.trim().length > 10000) {
//     return Response.json({ error: 'Invalid prompt (5-10000 chars)' }, { status: 400 });
//   }

//   const ac = new AbortController();

//   const stream = new ReadableStream({
//     async start(controller) {
//       try {
//         console.log('[Gemini Stream] Starting for prompt:', prompt.slice(0, 50));
//         await streamTextViaGenApi(
//           prompt,
//           (chunk) => {
//             controller.enqueue(
//               encoder.encode(JSON.stringify({ delta: chunk }) + '\n')
//             );
//           },
//           { pollMs: 500, totalMs: 120000 },
//           ac.signal
//         );
//         controller.enqueue(encoder.encode('{"done":true}\n'));
//         console.log('[Gemini Stream] Completed successfully');
//         controller.close();
//       } catch (e) {
//         const message = e instanceof Error ? e.message : 'Stream error';
//         console.error('[Gemini Stream] Error:', message);
//         controller.enqueue(encoder.encode(JSON.stringify({ error: message }) + '\n'));
//         controller.close();
//       }
//     },
//     cancel() {
//       ac.abort();
//     },
//   });

//   return new Response(stream, {
//     headers: {
//       'Content-Type': 'text/plain; charset=utf-8',
//       'Cache-Control': 'no-store',
//     },
//   });
// }