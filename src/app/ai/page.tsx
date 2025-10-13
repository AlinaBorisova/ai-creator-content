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

// Функция для извлечения HTML из markdown блока
function extractHtmlFromMarkdown(text: string): string {
  // Ищем блок ```html ... ```
  const htmlBlockMatch = text.match(/```html\s*([\s\S]*?)```/);
  if (htmlBlockMatch && htmlBlockMatch[1]) {
    let html = htmlBlockMatch[1].trim();
    
    // Если нашли отдельный блок CSS, попытаемся вставить его в HTML
    const cssBlockMatch = text.match(/```css\s*([\s\S]*?)```/);
    if (cssBlockMatch && cssBlockMatch[1]) {
      const cssContent = cssBlockMatch[1].trim();
      
      // Если в HTML нет тега <style>, добавим его в <head>
      if (!html.includes('<style>')) {
        if (html.includes('</head>')) {
          html = html.replace('</head>', `  <style>\n${cssContent}\n  </style>\n</head>`);
        } else if (html.includes('<head>')) {
          html = html.replace('<head>', `<head>\n  <style>\n${cssContent}\n  </style>`);
        } else {
          // Если нет <head>, создадим его
          html = html.replace('<html>', `<html>\n<head>\n  <style>\n${cssContent}\n  </style>\n</head>`);
        }
      }
    }
    
    return html;
  }
  
  // Если не нашли блок, но текст начинается с <!DOCTYPE или <html, возвращаем как есть
  const trimmed = text.trim();
  if (trimmed.startsWith('<!DOCTYPE') || trimmed.startsWith('<html')) {
    return trimmed;
  }
  
  // Иначе возвращаем пустую строку (нет валидного HTML)
  return '';
}

export default function AIPage() {
  const prompt = usePromptInput({ minLen: 5, maxLen: 2000 });
  const [mode, setMode] = useState<'text' | 'html'>('text');
  
  // Отдельные streams для каждого режима
  const [textStreams, setTextStreams] = useState<StreamState[]>(
    () => Array.from({ length: PANELS_COUNT }, () => ({ text: '', status: 'idle' }))
  );
  const [htmlStreams, setHtmlStreams] = useState<StreamState[]>(
    () => Array.from({ length: PANELS_COUNT }, () => ({ text: '', status: 'idle' }))
  );
  
  // Состояние редактирования для каждого блока
  const [editingStates, setEditingStates] = useState<boolean[]>(
    () => Array.from({ length: PANELS_COUNT }, () => false)
  );
  
  // Выбираем активные streams в зависимости от режима
  const streams = mode === 'html' ? htmlStreams : textStreams;
  const setStreams = mode === 'html' ? setHtmlStreams : setTextStreams;

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
  }, [setStreams]);

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

  const toggleEdit = useCallback((index: number) => {
    setEditingStates(prev => {
      const next = [...prev];
      next[index] = !next[index];
      return next;
    });
  }, []);

  const updateText = useCallback((index: number, newText: string) => {
    setStreams(prev => {
      const next = [...prev];
      if (!next[index]) return prev;
      next[index] = { ...next[index], text: newText };
      return next;
    });
  }, [setStreams]);

  const appendDelta = useCallback((index: number, delta: string) => {
    setStreams(prev => {
      const next = [...prev];
      const current = next[index];
      if (!current) return prev;
      if (current.status !== 'loading') return prev;
      next[index] = { ...current, text: current.text + delta };
      return next;
    });
  }, [setStreams]);

  const markDone = useCallback((index: number) => {
    setStreams(prev => {
      const next = [...prev];
      if (!next[index]) return prev;
      next[index] = { ...next[index], status: 'done' };
      return next;
    });
  }, [setStreams]);

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
          try {
            const msg = JSON.parse(line);
            if (msg.delta) {
              appendDelta(index, msg.delta);
            }
            if (msg.done) {
              markDone(index);
            }
          } catch (e) {
            // Пропускаем невалидные JSON строки (неполные чанки)
            console.warn('[Stream] Invalid JSON line, skipping:', line.slice(0, 50));
            continue;
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
  }, [appendDelta, markDone, setStreams]);

  const onSubmit = useCallback((e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!prompt.canSubmit) {
      prompt.setTouched(true);
      prompt.setError('Введите корректный промпт');
      return;
    }

    const finalPrompt = mode === 'html'
      ? `${prompt.value}

STRICT FORMAT REQUIRED - Output ONLY this structure:

\`\`\`html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Page Title</title>
  <style>
    /* ALL your CSS styles go here */
  </style>
</head>
<body>
  <!-- Your HTML content here -->
</body>
</html>
\`\`\`

RULES:
- Output ONLY the HTML code block above
- ALL styles must be inside the <style> tag in <head>
- NO separate CSS blocks
- NO explanations or text outside the code block
- Make it visually appealing with modern design
- Use BEM methodology for class names`
      : prompt.value;

    setStreams(Array.from({ length: PANELS_COUNT }, () => ({ text: '', status: 'loading' })));
    controllersRef.current = Array.from({ length: PANELS_COUNT }, () => new AbortController());

    for (let i = 0; i < PANELS_COUNT; i++) {
      const ctrl = controllersRef.current[i]!;
      startStream(i, finalPrompt, ctrl);
    }
  }, [prompt, startStream, mode, setStreams]);

  return (
    <main className="min-h-screen">
      <div className="max-w-7xl mx-auto w-full py-6 sm:py-10">
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setMode('text')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${mode === 'text'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
          >
            📝 Text
          </button>
          <button
            onClick={() => setMode('html')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${mode === 'html'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
          >
            🌐 HTML Preview
          </button>
        </div>
        <form onSubmit={onSubmit} className="flex flex-col items-center sm:flex-row gap-3 sm:gap-4">
          <div className="flex-1">
            <label className="sr-only" htmlFor="prompt">Prompt</label>
            <textarea
              id="prompt"
              placeholder={mode === 'html' ? 'Describe the HTML page you want...' : 'Enter your prompt'}
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
              {isStreaming ? 'Generating...' : (mode === 'html' ? 'Generate HTML' : 'Generate')}
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
            <div key={i} className="rounded-xl border border-gray-800 bg-gray-800/50 p-4 flex flex-col max-h-[600px] overflow-y-auto custom-scrollbar">
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

              {mode === 'html' ? (
                // HTML режим: 2 колонки
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1">
                  {/* Левая колонка: код */}
                  <div className="flex flex-col max-h-[600px] overflow-y-auto custom-scrollbar">
                    <h4 className="text-xs font-semibold text-gray-400 mb-2">HTML Code:</h4>
                    <div className="flex-1 overflow-auto bg-gray-900 rounded p-3 border border-gray-700">
                      {s.status === 'error' ? (
                        <p className="text-red-300 text-sm">{s.error ?? 'Error'}</p>
                      ) : editingStates[i] ? (
                        <textarea
                          value={s.text}
                          onChange={(e) => updateText(i, e.target.value)}
                          className="w-full h-full min-h-[400px] bg-gray-800 text-gray-300 text-xs font-mono p-2 rounded border border-gray-600 focus:outline-none focus:border-blue-500 resize-none"
                          spellCheck={false}
                        />
                      ) : (
                        <pre className="text-xs text-gray-300 whitespace-pre-wrap break-words">
                          {s.text || (s.status === 'loading' ? 'Generating…' : 'No code yet')}
                        </pre>
                      )}
                    </div>
                  </div>

                  {/* Правая колонка: preview */}
                  <div className="flex flex-col max-h-[600px] overflow-y-auto custom-scrollbar">
                    <h4 className="text-xs font-semibold text-gray-400 mb-2">Preview:</h4>
                    <div className="flex-1 bg-white rounded border border-gray-700 overflow-hidden">
                      {s.text && s.status !== 'error' ? (
                        (() => {
                          const html = extractHtmlFromMarkdown(s.text);
                          return html ? (
                            <iframe
                              srcDoc={html}
                              className="w-full h-full min-h-[400px] border-0"
                              sandbox="allow-scripts allow-same-origin"
                              title={`HTML Preview ${i + 1}`}
                            />
                          ) : (
                            <div className="flex items-center justify-center h-full min-h-[400px] text-gray-400 text-sm">
                              <p className="text-center px-4">
                                {s.status === 'loading' ? (
                                  'Waiting for HTML block...'
                                ) : (
                                  <>
                                    No HTML code block found.<br />
                                    <span className="text-xs">Looking for ```html ... ```</span>
                                  </>
                                )}
                              </p>
                            </div>
                          );
                        })()
                      ) : (
                        <div className="flex items-center justify-center h-full min-h-[400px] text-gray-400 text-sm">
                          {s.status === 'loading' ? 'Preview loading...' : 'No preview yet'}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                // Text режим: как раньше
                <div className="flex-1 overflow-auto min-h-[200px]">
                  {s.status === 'error' ? (
                    <p className="text-red-300">{s.error ?? 'Error'}</p>
                  ) : editingStates[i] ? (
                    <textarea
                      value={s.text}
                      onChange={(e) => updateText(i, e.target.value)}
                      className="w-full h-full min-h-[200px] bg-gray-800 text-gray-100 text-sm p-3 rounded border border-gray-600 focus:outline-none focus:border-blue-500 resize-none"
                      spellCheck={false}
                    />
                  ) : (
                    <div className="whitespace-pre-wrap break-words text-sm text-gray-100">
                      {s.text || (s.status === 'loading' ? 'Generating…' : 'No content yet')}
                    </div>
                  )}
                </div>
              )}

              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => toggleEdit(i)}
                  className={`${
                    editingStates[i]
                      ? 'bg-blue-600 hover:bg-blue-700'
                      : 'bg-gray-700 hover:bg-gray-600'
                  } text-white text-sm py-2 px-3 rounded-md transition-colors cursor-pointer disabled:opacity-60`}
                  disabled={!s.text || s.status === 'loading'}
                  title={editingStates[i] ? 'Finish editing' : 'Edit text'}
                >
                  {editingStates[i] ? '✓ Done' : '✏️ Edit'}
                </button>
                <button
                  type="button"
                  onClick={() => copyToClipboard(i)}
                  className="bg-gray-700 hover:bg-gray-600 text-white text-sm py-2 px-3 rounded-md transition-colors cursor-pointer disabled:opacity-60"
                  disabled={!s.text}
                  title="Copy to clipboard"
                >
                  📋 Copy
                </button>
                <button
                  type="button"
                  onClick={() => abortOne(i)}
                  className="bg-gray-700 hover:bg-gray-600 text-white text-sm py-2 px-3 rounded-md transition-colors cursor-pointer disabled:opacity-60"
                  disabled={s.status !== 'loading'}
                  title="Cancel this stream"
                >
                  ✕ Cancel
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}