'use client';

import { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import { usePromptInput } from '@/hooks/usePromtInput';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useStreams } from '@/hooks/useStreams';
import { useIframeHeight } from '@/hooks/useIframeHeight';
import { useCodePanels } from '@/hooks/useCodePanels';
import HistoryPanel from '../components/HistoryPanel';
import { StreamResult } from '@/app/components/StreamResult';
import { HistoryItem, PANELS_COUNT } from '@/types/stream';

export default function AIPage() {
  const prompt = usePromptInput({ minLen: 5, maxLen: 50000 });
  const [mode, setMode] = useState<'text' | 'html'>('html');
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  // История запросов для каждого режима
  const [textHistory, setTextHistory] = useLocalStorage<HistoryItem[]>('ai-text-history', []);
  const [htmlHistory, setHtmlHistory] = useLocalStorage<HistoryItem[]>('ai-html-history', []);

  // Выбираем активную историю в зависимости от режима
  const history = mode === 'html' ? htmlHistory : textHistory;
  const setHistory = mode === 'html' ? setHtmlHistory : setTextHistory;

  // Хуки для управления streams
  const { getStreams, setStreams, markDone, appendDelta } = useStreams();
  const streams = getStreams(mode);

  // Хук для управления высотой iframe
  const { iframeHeights, adjustIframeHeight } = useIframeHeight(mode, streams);

  // Хук для управления панелями кода
  const { openCodePanels, toggleCodePanel } = useCodePanels(mode, iframeHeights);

  // Состояние редактирования для каждого блока
  const [editingStates, setEditingStates] = useState<boolean[]>(
    () => Array.from({ length: PANELS_COUNT }, () => false)
  );

  const controllersRef = useRef<Array<AbortController | null>>(
    Array.from({ length: PANELS_COUNT }, () => null)
  );

  // Флаг для отслеживания сохранения результатов
  const hasSavedRef = useRef(false);

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
    setStreams(mode)(prev => {
      const next = [...prev];
      if (next[index].status === 'loading') {
        next[index] = { ...next[index], status: 'idle' };
      }
      return next;
    });
  }, [setStreams, mode]);

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
    setStreams(mode)(prev => {
      const next = [...prev];
      if (!next[index]) return prev;
      next[index] = { ...next[index], text: newText };
      return next;
    });
  }, [setStreams, mode]);

  const startStream = useCallback(async (index: number, p: string, ctrl: AbortController) => {
    console.log(`🚀 Starting stream ${index} with prompt:`, p.slice(0, 50));
    try {
      const res = await fetch('/api/ai/gemini/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: p }),
        signal: ctrl.signal,
      });
      
      if (!res.ok) {
        console.error(`❌ Stream ${index} HTTP error:`, res.status, res.statusText);
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      
      if (!res.body) {
        console.error(`❌ Stream ${index} no body`);
        throw new Error('No response body');
      }
  
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
  
      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          console.log(`🏁 Stream ${index} completed`);
          break;
        }
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
  
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const msg = JSON.parse(line);
            if (msg.delta) {
              console.log(`📝 Stream ${index} received delta:`, msg.delta.slice(0, 50));
              await new Promise(resolve => setTimeout(resolve, 10));
              appendDelta(index, msg.delta, mode);
            }
            if (msg.done) {
              console.log(`✅ Stream ${index} received done signal`);
              // Добавляем задержку, чтобы все дельты успели обработаться
              setTimeout(() => {
                markDone(index, mode);
              }, 500);
            }
          } catch (e) {
            console.warn(`[Stream ${index}] Invalid JSON line, skipping:`, line.slice(0, 50));
            continue;
          }
        }
      }
    } catch (err) {
      if (ctrl.signal.aborted) {
        console.log(`❌ Stream ${index} aborted`);
        return;
      }
      const message = err instanceof Error ? err.message : 'Stream error';
      console.error(`❌ Stream ${index} error:`, message);
      setStreams(mode)(prev => {
        const next = [...prev];
        next[index] = { ...next[index], status: 'error', error: message };
        return next;
      });
    }
  }, [appendDelta, markDone, setStreams, mode]);

  const onSubmit = useCallback((e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!prompt.canSubmit) {
      prompt.setTouched(true);
      prompt.setError('Введите корректный промпт');
      return;
    }

    console.log('🎯 Starting generation with prompt:', prompt.value);

    // Сбрасываем флаг сохранения
    hasSavedRef.current = false;

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

    console.log('🚀 Setting streams to loading state');
    setStreams(mode)(Array.from({ length: PANELS_COUNT }, () => ({ text: '', status: 'loading' })));
    controllersRef.current = Array.from({ length: PANELS_COUNT }, () => new AbortController());

    console.log('🎬 Starting', PANELS_COUNT, 'streams');
    for (let i = 0; i < PANELS_COUNT; i++) {
      const ctrl = controllersRef.current[i]!;
      startStream(i, finalPrompt, ctrl);
    }
  }, [prompt, startStream, mode, setStreams]);

  const saveToHistory = useCallback((promptText: string, results: any[]) => {
    console.log('Saving to history:', promptText, results);

    const newItem: HistoryItem = {
      id: Date.now().toString(),
      prompt: promptText,
      timestamp: Date.now(),
      results: results.map(r => ({ ...r })),
    };

    setHistory(prev => {
      const exists = prev.some(item => item.prompt === promptText);
      if (exists) {
        return prev.map(item =>
          item.prompt === promptText
            ? { ...item, results: results.map(r => ({ ...r })), timestamp: Date.now() }
            : item
        );
      }
      return [newItem, ...prev].slice(0, 20);
    });
  }, [setHistory]);

  const loadFromHistory = useCallback((item: HistoryItem) => {
    console.log('Loading from history:', item);

    prompt.setValue(item.prompt);

    if (item.results && item.results.length > 0) {
      const paddedResults = Array.from({ length: PANELS_COUNT }, (_, i) => {
        if (i < item.results!.length) {
          return { ...item.results![i] };
        } else {
          return { text: '', status: 'idle' as const };
        }
      });

      setStreams(mode)(paddedResults);
    } else {
      setStreams(mode)(Array.from({ length: PANELS_COUNT }, () => ({ text: '', status: 'idle' })));
    }
  }, [prompt, setStreams, mode]);

  const deleteFromHistory = useCallback((id: string) => {
    setHistory(prev => prev.filter(item => item.id !== id));
  }, [setHistory]);

  // Автоматически сохраняем результаты в историю после завершения генерации
  useEffect(() => {
    const allDone = streams.every(s => s.status === 'done' || s.status === 'error');
    const hasContent = streams.some(s => s.text);

    if (allDone && hasContent && !hasSavedRef.current) {
      hasSavedRef.current = true;
      saveToHistory(prompt.value, streams);
    } else if (!allDone) {
      hasSavedRef.current = false;
    }
  }, [streams, prompt.value, saveToHistory]);

  return (
    <main className="min-h-screen">
      <div className="w-full mx-auto w-full py-6 sm:py-10 px-4">
        <div className="flex gap-6">
          {/* Кнопка для открытия истории */}
          <button
            onClick={() => setIsHistoryOpen(!isHistoryOpen)}
            className={`relative w-[50px] h-[50px] top-0 left-0 bg-gray-800 hover:bg-gray-700 text-gray-300 p-3 rounded-lg shadow-lg transition-all duration-300 hover:scale-105 ${isHistoryOpen ? 'hidden' : 'block'}`}
            title="История запросов"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>

          {/* Компонент истории */}
          <HistoryPanel
            mode={mode}
            history={history}
            isOpen={isHistoryOpen}
            onClose={() => setIsHistoryOpen(false)}
            onLoadFromHistory={loadFromHistory}
            onDeleteFromHistory={deleteFromHistory}
          />

          {/* Основной контент справа */}
          <div className="flex-1 min-w-0">
            {/* Кнопки режимов */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setMode('html')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${mode === 'html'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
              >
                🌐 HTML Preview
              </button>
              <button
                onClick={() => setMode('text')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${mode === 'text'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
              >
                📝 Text
              </button>
            </div>

            {/* Форма */}
            <form onSubmit={onSubmit} className="flex flex-col items-center sm:flex-row gap-3 sm:gap-4">
              <div className="flex-1">
                <label className="sr-only" htmlFor="prompt">Prompt</label>
                <textarea
                  id="prompt"
                  placeholder={mode === 'html' ? 'Describe the HTML page you want...' : 'Enter your prompt'}
                  className="w-full border border-gray-700 rounded-lg px-4 py-4 min-h-[250px] sm:min-h-[120px] bg-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  value={prompt.value}
                  onChange={prompt.onChange}
                  onBlur={prompt.onBlur}
                  maxLength={50000}
                  aria-invalid={Boolean(prompt.touched && prompt.error)}
                  aria-describedby="prompt-help prompt-error"
                />
                <div className="mt-2 flex items-center justify-between text-sm text-gray-400">
                  <span id="prompt-help">{prompt.length}/50000</span>
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
              </div>
            </form>

            {/* Результаты */}
            <div className="w-full flex flex-col gap-4 mt-8">
              {streams.map((s, i) => (
                <StreamResult
                  key={i}
                  stream={s}
                  index={i}
                  mode={mode}
                  isEditing={editingStates[i]}
                  isCodePanelOpen={openCodePanels[i]}
                  iframeHeight={iframeHeights[i] || 400}
                  onToggleEdit={toggleEdit}
                  onUpdateText={updateText}
                  onCopyToClipboard={copyToClipboard}
                  onAbort={abortOne}
                  onToggleCodePanel={toggleCodePanel}
                  onAdjustIframeHeight={adjustIframeHeight}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}