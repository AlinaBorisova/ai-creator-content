'use client';

import { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import { usePromptInput } from '@/hooks/usePromtInput';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import HistoryPanel from '../components/HistoryPanel';

type StreamStatus = 'idle' | 'loading' | 'done' | 'error';

type StreamState = {
  text: string;
  status: StreamStatus;
  error?: string | null;
};

type HistoryItem = {
  id: string;
  prompt: string;
  timestamp: number;
  results?: StreamState[];
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
  const prompt = usePromptInput({ minLen: 5, maxLen: 10000 });
  const [mode, setMode] = useState<'text' | 'html'>('text');
  const [openCodePanels, setOpenCodePanels] = useState<boolean[]>(
    () => Array.from({ length: PANELS_COUNT }, () => false)
  );
  const [iframeHeights, setIframeHeights] = useState<number[]>(
    () => Array.from({ length: PANELS_COUNT }, () => 400)
  );

  // История запросов для каждого режима
  const [textHistory, setTextHistory] = useLocalStorage<HistoryItem[]>('ai-text-history', []);
  const [htmlHistory, setHtmlHistory] = useLocalStorage<HistoryItem[]>('ai-html-history', []);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);


  // Выбираем активную историю в зависимости от режима
  const history = mode === 'html' ? htmlHistory : textHistory;
  const setHistory = mode === 'html' ? setHtmlHistory : setTextHistory;

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

  // Флаг для отслеживания сохранения результатов
  const hasSavedRef = useRef(false);

  const syncColumnHeights = useCallback(() => {
    console.log('🔄 syncColumnHeights called');
    console.log('Current iframe heights:', iframeHeights);

    const containers = document.querySelectorAll('.result-container');

    containers.forEach((container, index) => {
      const codeColumn = container.querySelector('.code-column');

      if (codeColumn) {
        const codeContent = codeColumn.querySelector('.code-content');

        if (codeContent) {
          const iframeHeight = iframeHeights[index] || 400;
          const newHeight = Math.max(iframeHeight - 60, 300); // минимум 300px
          (codeContent as HTMLElement).style.height = `${newHeight}px`;
          console.log(`Container ${index}: Setting code height to ${newHeight}px (iframe: ${iframeHeight}px)`);
        }
      }
    });
  }, [iframeHeights]);

  // Функция для изменения высоты iframe
  const adjustIframeHeight = useCallback((iframe: HTMLIFrameElement, index: number) => {
    try {
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (doc) {
        const height = Math.max(
          doc.body.scrollHeight,
          doc.body.offsetHeight,
          doc.documentElement.clientHeight,
          doc.documentElement.scrollHeight,
          doc.documentElement.offsetHeight
        );
        iframe.style.height = `${height}px`;

        // Сохраняем высоту в состоянии
        setIframeHeights(prev => {
          const next = [...prev];
          next[index] = height;
          return next;
        });
      }
    } catch (e) {
      // Если не можем получить доступ к содержимому (CORS), используем минимальную высоту
      iframe.style.height = '400px';
      setIframeHeights(prev => {
        const next = [...prev];
        next[index] = 400;
        return next;
      });
    }
  }, []);



  // useEffect для обработки изменения содержимого
  useEffect(() => {
    const iframes = document.querySelectorAll('iframe[title*="HTML Preview"]');

    iframes.forEach((iframe, index) => {
      const htmlIframe = iframe as HTMLIFrameElement;
      adjustIframeHeight(htmlIframe, index);

      const handleLoad = () => {
        adjustIframeHeight(htmlIframe, index);
      };

      htmlIframe.addEventListener('load', handleLoad);

      return () => {
        htmlIframe.removeEventListener('load', handleLoad);
      };
    });
  }, [streams, adjustIframeHeight]);

  // useEffect для синхронизации при изменении состояния панелей
  useEffect(() => {
    if (mode === 'html') {
      const timer = setTimeout(() => {
        syncColumnHeights();
      }, 350);

      return () => clearTimeout(timer);
    }
  }, [openCodePanels, syncColumnHeights, mode]);

  // useEffect для синхронизации при изменении высот iframe
  useEffect(() => {
    if (mode === 'html') {
      syncColumnHeights();
    }
  }, [iframeHeights, syncColumnHeights, mode]);

  const toggleCodePanel = useCallback((index: number) => {
    setOpenCodePanels(prev => {
      const next = [...prev];
      next[index] = !next[index];
      return next;
    });

    // Принудительная синхронизация после изменения состояния (только в HTML режиме)
    if (mode === 'html') {
      setTimeout(() => {
        syncColumnHeights();
      }, 100);
    }
  }, [syncColumnHeights, mode]);



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

  const markDone = useCallback((index: number) => {
    console.log(`✅ Stream ${index} marked as done`);
    setStreams(prev => {
      const next = [...prev];
      if (!next[index]) return prev;
      next[index] = { ...next[index], status: 'done' };
      console.log(`📊 Updated streams after markDone:`, next.map((s, i) => ({
        index: i,
        status: s.status,
        hasText: !!s.text,
        textLength: s.text.length
      })));
      return next;
    });
  }, [setStreams]);

  const appendDelta = useCallback((index: number, delta: string) => {
    console.log(`Appending delta to stream ${index}:`, delta.slice(0, 50));
    setStreams(prev => {
      const next = [...prev];
      const current = next[index];
      if (!current) return prev;
      if (current.status !== 'loading') return prev;
      next[index] = { ...current, text: current.text + delta };
      return next;
    });
  }, [setStreams]);

  const startStream = useCallback(async (index: number, p: string, ctrl: AbortController) => {
    console.log(`🚀 Starting stream ${index} with prompt:`, p.slice(0, 50));
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
              appendDelta(index, msg.delta);
            }
            if (msg.done) {
              console.log(`✅ Stream ${index} received done signal`);
              markDone(index);
            }
          } catch (e) {
            console.warn('[Stream] Invalid JSON line, skipping:', line.slice(0, 50));
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
    setStreams(Array.from({ length: PANELS_COUNT }, () => ({ text: '', status: 'loading' })));
    controllersRef.current = Array.from({ length: PANELS_COUNT }, () => new AbortController());

    console.log('🎬 Starting', PANELS_COUNT, 'streams');
    for (let i = 0; i < PANELS_COUNT; i++) {
      const ctrl = controllersRef.current[i]!;
      startStream(i, finalPrompt, ctrl);
    }
  }, [prompt, startStream, mode, setStreams]);

  const saveToHistory = useCallback((promptText: string, results: StreamState[]) => {
    console.log('Saving to history:', promptText, results); // Отладка

    const newItem: HistoryItem = {
      id: Date.now().toString(),
      prompt: promptText,
      timestamp: Date.now(),
      results: results.map(r => ({ ...r })), // Копируем результаты
    };

    setHistory(prev => {
      // Проверяем, нет ли уже такого промпта в истории
      const exists = prev.some(item => item.prompt === promptText);
      if (exists) {
        // Если существует, обновляем результаты
        const updated = prev.map(item =>
          item.prompt === promptText
            ? { ...item, results: results.map(r => ({ ...r })), timestamp: Date.now() }
            : item
        );
        console.log('Updated existing history item:', updated);
        return updated;
      }

      // Добавляем в начало массива и ограничиваем до 20 элементов
      const newHistory = [newItem, ...prev].slice(0, 20);
      console.log('Added new history item:', newHistory);
      return newHistory;
    });
  }, [setHistory]);


  const loadFromHistory = useCallback((item: HistoryItem) => {
    console.log('Loading from history:', item); // Отладка
    console.log('Item results:', item.results);

    prompt.setValue(item.prompt);

    // Загружаем сохраненные результаты, если они есть
    if (item.results && item.results.length > 0) {
      // Создаем массив из 5 элементов, заполняя недостающие пустыми
      const paddedResults = Array.from({ length: PANELS_COUNT }, (_, i) => {
        if (i < item.results!.length) {
          return { ...item.results![i] };
        } else {
          return { text: '', status: 'idle' as StreamStatus };
        }
      });

      console.log('Setting streams with padded results:', paddedResults);
      setStreams(paddedResults);
    } else {
      console.log('No results, resetting streams');
      // Если результатов нет, сбрасываем streams
      setStreams(Array.from({ length: PANELS_COUNT }, () => ({ text: '', status: 'idle' })));
    }
  }, [prompt, setStreams]);

  const deleteFromHistory = useCallback((id: string) => {
    setHistory(prev => prev.filter(item => item.id !== id));
  }, [setHistory]);

  // Автоматически сохраняем результаты в историю после завершения генерации
  useEffect(() => {
    console.log('🔄 useEffect triggered for saveResultsToHistory');

    const allDone = streams.every(s => s.status === 'done' || s.status === 'error');
    const hasContent = streams.some(s => s.text);

    console.log('📊 Direct check in useEffect:', {
      allDone,
      hasContent,
      hasSaved: hasSavedRef.current,
      streams: streams.map((s, i) => ({
        index: i,
        status: s.status,
        hasText: !!s.text,
        textLength: s.text.length
      }))
    });

    if (allDone && hasContent && !hasSavedRef.current) {
      console.log('💾 Saving results to history from useEffect...');
      hasSavedRef.current = true;

      const newItem: HistoryItem = {
        id: Date.now().toString(),
        prompt: prompt.value,
        timestamp: Date.now(),
        results: streams.map(r => ({ ...r })),
      };

      setHistory(prev => {
        const exists = prev.some(item => item.prompt === prompt.value);
        if (exists) {
          return prev.map(item =>
            item.prompt === prompt.value
              ? { ...item, results: streams.map(r => ({ ...r })), timestamp: Date.now() }
              : item
          );
        }
        return [newItem, ...prev].slice(0, 20);
      });
    } else if (!allDone) {
      // Сбрасываем флаг при новой генерации
      hasSavedRef.current = false;
    }
  }, [streams, prompt.value, setHistory]);


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

            {/* ... кнопки режимов ... */}
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

            {/* ... форма ... */}
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
                  maxLength={10000}
                  aria-invalid={Boolean(prompt.touched && prompt.error)}
                  aria-describedby="prompt-help prompt-error"
                />
                <div className="mt-2 flex items-center justify-between text-sm text-gray-400">
                  <span id="prompt-help">{prompt.length}/10000</span>
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

            {/* ... результаты ... */}
            <div className="w-full flex flex-col gap-4 mt-8">
              {streams.map((s, i) => (
                <div key={i} className="rounded-xl border border-gray-800 bg-gray-800/50 p-4 flex flex-col">
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
                    // HTML режим: кнопка слева + preview + выдвижной блок с кодом
                    <div className="w-full result-container">
                      <div className="relative flex">
                        {/* Кнопка для показа/скрытия кода слева */}
                        <button
                          onClick={() => toggleCodePanel(i)}
                          className={`flex-shrink-0 w-12 h-12 mr-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 flex flex-col items-center justify-center cursor-pointer transition-all duration-300 ${openCodePanels[i] ? 'bg-blue-600 hover:bg-blue-700 hidden' : ''
                            }`}
                          title={openCodePanels[i] ? 'Скрыть код' : 'Показать код'}
                        >
                          <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                          </svg>
                          <span className="text-xs">Code</span>
                        </button>

                        {/* Контейнер для preview и кода */}
                        <div className="flex-1 flex">
                          {/* Блок с кодом */}
                          <div className={`bg-gray-900 border-r border-gray-700 transition-all duration-300 ease-in-out code-column ${openCodePanels[i]
                            ? 'w-1/2 opacity-100 translate-x-0'
                            : 'w-0 opacity-0 -translate-x-full overflow-hidden'
                            }`}>
                            <div
                              className="flex flex-col min-w-0"
                              style={{ height: `${iframeHeights[i] || 400}px` }}
                            >
                              <div className="flex items-center justify-between p-2">
                                <h4 className="text-sm font-semibold text-gray-200">HTML Code</h4>
                                <button
                                  onClick={() => toggleCodePanel(i)}
                                  className="text-gray-400 hover:text-gray-200 transition-colors cursor-pointer"
                                >
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              </div>

                              <div
                                className="flex-1 overflow-y-auto custom-scrollbar code-content"
                                style={{
                                  minHeight: '300px',
                                  height: `${Math.max((iframeHeights[i] || 400) - 60, 300)}px`
                                }}
                              >
                                <div className="bg-gray-800 rounded p-3 border border-gray-700 h-full">
                                  {s.status === 'error' ? (
                                    <p className="text-red-300 text-sm">{s.error ?? 'Error'}</p>
                                  ) : editingStates[i] ? (
                                    <textarea
                                      value={s.text}
                                      onChange={(e) => updateText(i, e.target.value)}
                                      className="w-full h-full min-h-[300px] bg-gray-700 text-gray-300 text-sm font-mono p-2 rounded border border-gray-600 focus:outline-none focus:border-blue-500 resize-none"
                                      spellCheck={false}
                                    />
                                  ) : (
                                    <pre className="text-sm text-gray-300 whitespace-pre-wrap break-words h-full overflow-auto">
                                      {s.text || (s.status === 'loading' ? 'Generating…' : 'No code yet')}
                                    </pre>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Preview */}
                          <div className={`bg-white border border-gray-700 overflow-hidden transition-all duration-300 preview-column ${openCodePanels[i]
                            ? 'w-1/2 rounded-l-none'
                            : 'w-full rounded-l'
                            }`}>
                            {s.text && s.status !== 'error' ? (
                              (() => {
                                const html = extractHtmlFromMarkdown(s.text);
                                return html ? (
                                  <iframe
                                    srcDoc={html}
                                    className="w-full border-0"
                                    style={{ height: '400px' }}
                                    sandbox="allow-scripts allow-same-origin"
                                    title={`HTML Preview ${i + 1}`}
                                    onLoad={(e) => {
                                      const iframe = e.target as HTMLIFrameElement;
                                      adjustIframeHeight(iframe, i);
                                    }}
                                  />
                                ) : (
                                  <div className="flex items-center justify-center h-[400px] text-gray-400 text-sm">
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
                              <div className="flex items-center justify-center h-[400px] text-gray-400 text-sm">
                                {s.status === 'loading' ? 'Preview loading...' : 'No preview yet'}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    // Text режим
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
                      className={`${editingStates[i]
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
        </div >
      </div >
    </main >
  );
}