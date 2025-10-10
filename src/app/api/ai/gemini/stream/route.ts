import { streamTextViaGenApi } from "@/lib/gemini";

const encoder = new TextEncoder();

export async function POST(req: Request) {
  const { prompt } = await req.json().catch(() => ({}));
  if (!prompt || typeof prompt !== 'string' || prompt.trim().length < 5 || prompt.trim().length > 2000) {
    return Response.json({ error: 'Invalid prompt (5-2000 chars)' }, { status: 400 });
  }

  const ac = new AbortController();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        console.log('[Gemini Stream] Starting for prompt:', prompt.slice(0, 50));
        await streamTextViaGenApi(
          prompt,
          (chunk) => {
            controller.enqueue(
              encoder.encode(JSON.stringify({ delta: chunk }) + '\n')
            );
          },
          { pollMs: 500, totalMs: 120000 },
          ac.signal
        );
        controller.enqueue(encoder.encode('{"done":true}\n'));
        console.log('[Gemini Stream] Completed successfully');
        controller.close();
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Stream error';
        console.error('[Gemini Stream] Error:', message);
        controller.enqueue(encoder.encode(JSON.stringify({ error: message }) + '\n'));
        controller.close();
      }
    },
    cancel() {
      ac.abort();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}