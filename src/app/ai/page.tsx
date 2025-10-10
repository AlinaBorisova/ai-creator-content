'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { usePromptInput } from '@/hooks/usePromtInput';

type StreamStatus = 'idle' | 'loading' | 'done' | 'error';

type StreamState = {
  text: string;
  status: StreamStatus;
  error?: string | null;
};

const PANELS_COUNT = 5;

export default function AIPage() {
  const prompt = usePromptInput({ minLen: 5, maxLen: 2000 });
  const [streams, setStreams] = useState<StreamState[]>(
    () => Array.from({ length: PANELS_COUNT }, () => ({ text: '', status: 'idle' }))
  );
  const controllersRef = useRef<Array<AbortController | null>>(
    Array.from({ length: PANELS_COUNT }, () => null)
  );

  const isStreaming = useMemo(
    () => streams.some(s => s.status === 'loading'),
    [streams]
  );

  const abortOne = useCallback((index: number) => {
    const ctrl = controllersRef.current[index];
    if (ctrl) {
      ctrl.abort();
      controllersRef.current[index] = null;
    }
    setStreams(prev => {
      const next = [...prev];
      if (next[index].status === 'loading') {
        next[index] = { ...next[index], status: 'idle' };
      }
      return next;
    });
  }, []);

  // const abortAll = useCallback(() => {
  //   controllersRef.current.forEach((c, i) => {
  //     if (c) c.abort();
  //     controllersRef.current[i] = null;
  //   });
  //   setStreams(prev =>
  //     prev.map(s => (s.status === 'loading' ? { ...s, status: 'idle' } : s))
  //   );
  // }, []);

  const copyToClipboard = useCallback(async (index: number) => {
    const text = streams[index]?.text ?? '';
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // no-op
    }
  }, [streams]);

  const appendDelta = useCallback((index: number, delta: string) => {
    setStreams(prev => {
      const next = [...prev];
      const current = next[index];
      if (!current) return prev;
      if (current.status !== 'loading') return prev;
      next[index] = { ...current, text: current.text + delta };
      return next;
    });
  }, []);

  const markDone = useCallback((index: number) => {
    setStreams(prev => {
      const next = [...prev];
      if (!next[index]) return prev;
      next[index] = { ...next[index], status: 'done' };
      return next;
    });
  }, []);

  const startStream = useCallback(async (index: number, p: string, ctrl: AbortController) => {
    try {
      const res = await fetch('/api/ai/gemini/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: p }),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) throw new Error('Streaming failed');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.trim()) continue;
          const msg = JSON.parse(line);
          if (msg.delta) {
            appendDelta(index, msg.delta);
          }
          if (msg.done) {
            markDone(index);
          }
        }
      }
    } catch (err) {
      if (ctrl.signal.aborted) return;
      const message = err instanceof Error ? err.message : 'Stream error';
      setStreams(prev => {
        const next = [...prev];
        next[index] = { ...next[index], status: 'error', error: message };
        return next;
      });
    }
  }, [appendDelta, markDone]);

  const onSubmit = useCallback((e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!prompt.canSubmit) {
      prompt.setTouched(true);
      prompt.setError('Введите корректный промпт');
      return;
    }

    setStreams(Array.from({ length: PANELS_COUNT }, () => ({ text: '', status: 'loading' })));
    controllersRef.current = Array.from({ length: PANELS_COUNT }, () => new AbortController());

    for (let i = 0; i < PANELS_COUNT; i++) {
      const ctrl = controllersRef.current[i]!;
      startStream(i, prompt.value, ctrl);
    }
  }, [prompt, startStream]);

  return (
    <main className="min-h-screen">
      <div className="max-w-7xl mx-auto w-full py-6 sm:py-10">
        <form onSubmit={onSubmit} className="flex flex-col items-center sm:flex-row gap-3 sm:gap-4">
          <div className="flex-1">
            <label className="sr-only" htmlFor="prompt">Prompt</label>
            <textarea
              id="prompt"
              placeholder="Enter your prompt"
              className="w-full border border-gray-700 rounded-lg px-4 py-4 min-h-[120px] sm:min-h-[80px] bg-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              value={prompt.value}
              onChange={prompt.onChange}
              onBlur={prompt.onBlur}
              maxLength={2000}
              aria-invalid={Boolean(prompt.touched && prompt.error)}
              aria-describedby="prompt-help prompt-error"
            />
            <div className="mt-2 flex items-center justify-between text-sm text-gray-400">
              <span id="prompt-help">{prompt.length}/2000</span>
              {prompt.touched && prompt.error && (
                <span id="prompt-error" className="text-red-400">{prompt.error}</span>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:gap-3 sm:w-auto">
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-lg transition-colors cursor-pointer w-full sm:w-auto"
              disabled={!prompt.canSubmit || isStreaming}
            >
              {isStreaming ? 'Generating...' : 'Generate'}
            </button>
            {/* <button
              type="button"
              onClick={abortAll}
              className="bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-colors cursor-pointer w-full sm:w-auto"
              disabled={!isStreaming}
            >
              Cancel all
            </button> */}
          </div>
        </form>

        <div className="w-full flex flex-col gap-4 mt-8">
          {streams.map((s, i) => (
            <div key={i} className="rounded-xl border border-gray-800 bg-gray-800/50 p-4 flex flex-col min-h-[200px]">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-200">Result #{i + 1}</h3>
                <span className={
                  s.status === 'loading'
                    ? 'text-xs px-2 py-1 rounded bg-blue-900/40 text-blue-300'
                    : s.status === 'done'
                      ? 'text-xs px-2 py-1 rounded bg-green-900/30 text-green-300'
                      : s.status === 'error'
                        ? 'text-xs px-2 py-1 rounded bg-red-900/30 text-red-300'
                        : 'text-xs px-2 py-1 rounded bg-gray-700 text-gray-300'
                }>
                  {s.status}
                </span>
              </div>

              <div className="flex-1 overflow-auto whitespace-pre-wrap break-words text-sm text-gray-100">
                {s.text || (s.status === 'loading' ? 'Generating…' : 'No content yet')}
              </div>

              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => copyToClipboard(i)}
                  className="bg-gray-700 hover:bg-gray-600 text-white text-sm py-2 px-3 rounded-md transition-colors cursor-pointer disabled:opacity-60"
                  disabled={!s.text}
                  title="Copy to clipboard"
                >
                  Copy
                </button>
                <button
                  type="button"
                  onClick={() => abortOne(i)}
                  className="bg-gray-700 hover:bg-gray-600 text-white text-sm py-2 px-3 rounded-md transition-colors cursor-pointer disabled:opacity-60"
                  disabled={s.status !== 'loading'}
                  title="Cancel this stream"
                >
                  Cancel
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}