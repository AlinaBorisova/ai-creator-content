'use client';

import { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import { usePromptInput } from '@/hooks/usePromtInput';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useStreams } from '@/hooks/useStreams';
import { useIframeHeight } from '@/hooks/useIframeHeight';
import { useCodePanels } from '@/hooks/useCodePanels';
import HistoryPanel from '../components/HistoryPanel';
import { StreamResult } from '@/app/components/StreamResult';
import { StreamState } from '@/types/stream';
import { HistoryItem, PANELS_COUNT } from '@/types/stream';
import Image from 'next/image';

// Тип для изображения
interface GeneratedImage {
  imageBytes: string;
  mimeType: string;
  index?: number;
}

// Тип для результата генерации изображения
interface ImageGenerationResult {
  prompt: string;
  images: GeneratedImage[];
  status: 'idle' | 'loading' | 'done' | 'error';
  error?: string;
  translatedPrompt?: string;
  hasSlavicPrompts?: boolean;
  wasTranslated?: boolean;
}

export default function AIPage() {
  const prompt = usePromptInput({ minLen: 5, maxLen: 50000 });
  const [mode, setMode] = useState<'text' | 'html' | 'images'>('html');
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isImagesDropdownOpen, setIsImagesDropdownOpen] = useState(false);
  const [selectedImageModel, setSelectedImageModel] = useState<string | null>(null);

  // Состояние для парсинга промптов в режиме изображений
  const [parsedPrompts, setParsedPrompts] = useState<string[]>([]);
  const [isParsingPrompts, setIsParsingPrompts] = useState(false);
  const [imageResults, setImageResults] = useState<ImageGenerationResult[]>([]);
  const [isGeneratingImages, setIsGeneratingImages] = useState(false);

  // История запросов для каждого режима
  const [textHistory, setTextHistory] = useLocalStorage<HistoryItem[]>('ai-text-history', []);
  const [htmlHistory, setHtmlHistory] = useLocalStorage<HistoryItem[]>('ai-html-history', []);
  const [imageHistory, setImageHistory] = useLocalStorage<HistoryItem[]>('ai-image-history', []);

  // Выбираем активную историю в зависимости от режима
  const history = mode === 'html' ? htmlHistory : mode === 'text' ? textHistory : imageHistory;
  const setHistory = mode === 'html' ? setHtmlHistory : mode === 'text' ? setTextHistory : setImageHistory;


  // Хуки для управления streams
  const { getStreams, setStreams, markDone, appendDelta } = useStreams();
  const streams = getStreams(mode);

  // Список нейросетей для генерации изображений
  const imageModels = [
    'Imagen 4',
    'Flux',
    'Banana',
    'Ideogram'
  ];

  // Функция для парсинга промптов из основного инпута
  const parsePrompts = useCallback((inputText: string): string[] => {
    return inputText
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
  }, []);

  // Функция для генерации изображений через Imagen API
  const generateImages = useCallback(async (promptText: string): Promise<{images: GeneratedImage[], translation?: {original: string, translated: string, language: string, wasTranslated: boolean, hasSlavicPrompts: boolean}}> => {
    try {
      const response = await fetch('/api/ai/imagen', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: promptText,
          numberOfImages: 2,
          imageSize: '1K',
          aspectRatio: '1:1'
        })
      });

      if (!response.ok) {
        throw new Error('Failed to generate images');
      }

      const data = await response.json();
      return {
        images: data.images || [],
        translation: data.translation
      };
    } catch (error) {
      console.error('Error generating images:', error);
      throw error;
    }
  }, []);

  // Функция для обработки режима изображений
  const handleImagesMode = useCallback(async () => {
    if (!prompt.value.trim()) return;

    const prompts = parsePrompts(prompt.value);
    console.log('📝 Parsed prompts:', prompts);

    if (prompts.length === 0) {
      prompt.setError('Введите хотя бы один промпт');
      return;
    }

    if (prompts.length > PANELS_COUNT) {
      prompt.setError(`Максимум ${PANELS_COUNT} промптов за раз`);
      return;
    }

    setIsParsingPrompts(true);
    setParsedPrompts(prompts);

    // Инициализируем результаты генерации
    const initialResults: ImageGenerationResult[] = prompts.map(promptText => ({
      prompt: promptText,
      images: [],
      status: 'loading',
      translatedPrompt: undefined,
      hasSlavicPrompts: false,
      wasTranslated: false
    }));
    setImageResults(initialResults);

    // Проверяем, выбрана ли модель Imagen 4
    const isImagen4 = selectedImageModel === 'Imagen 4';
    
    if (isImagen4) {
      // Генерируем изображения через Imagen 4 API
      setIsGeneratingImages(true);
      
      try {
        const results: ImageGenerationResult[] = [];
        
        for (let i = 0; i < prompts.length; i++) {
          const promptText = prompts[i];
          console.log(`🎨 Generating images for prompt ${i + 1}:`, promptText);
          
          try {
            const result = await generateImages(promptText);
            
            results.push({
              prompt: promptText,
              images: result.images,
              status: 'done',
              translatedPrompt: result.translation?.translated || promptText,
              hasSlavicPrompts: result.translation?.hasSlavicPrompts || false,
              wasTranslated: result.translation?.wasTranslated || false
            });
          } catch (error) {
            console.error(`Error generating images for prompt ${i + 1}:`, error);
            results.push({
              prompt: promptText,
              images: [],
              status: 'error',
              error: error instanceof Error ? error.message : 'Unknown error',
              translatedPrompt: undefined,
              hasSlavicPrompts: false,
              wasTranslated: false
            });
          }
          
          // Обновляем результаты по мере генерации
          setImageResults([...results]);
        }
      } catch (error) {
        console.error('Error in image generation process:', error);
      } finally {
        setIsGeneratingImages(false);
        setIsParsingPrompts(false);
      }
    } else {
      // Для других моделей показываем заглушки
      console.log('🎨 Using placeholder for model:', selectedImageModel);
      
      setTimeout(() => {
        const placeholderResults: ImageGenerationResult[] = prompts.map(promptText => ({
          prompt: promptText,
          images: [],
          status: 'done',
          translatedPrompt: undefined,
          hasSlavicPrompts: false,
          wasTranslated: false
        }));
        setImageResults(placeholderResults);
        setIsParsingPrompts(false);
      }, 1000); // Небольшая задержка для имитации генерации
    }
  }, [prompt, parsePrompts, generateImages, selectedImageModel]);

  const downloadImage = useCallback(async (imageBytes: string, mimeType: string, filename: string) => {
    try {
      // Создаем blob из base64 данных
      const byteCharacters = atob(imageBytes);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: mimeType });

      // Создаем ссылку для скачивания
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      console.log('📥 Image downloaded:', filename);
    } catch (error) {
      console.error('❌ Error downloading image:', error);
    }
  }, []);

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

  // Функция для копирования промпта в режиме изображений
  const copyPromptToClipboard = useCallback(async (promptText: string) => {
    try {
      await navigator.clipboard.writeText(promptText);
      console.log('Промпт скопирован в буфер обмена');
    } catch (error) {
      console.error('Ошибка при копировании промпта:', error);
    }
  }, []);

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
          } catch {
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

    // Обработка режима изображений
    if (mode === 'images') {
      handleImagesMode();
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

    console.log('🚀 Setting streams to loading state');
    setStreams(mode)(Array.from({ length: PANELS_COUNT }, () => ({ text: '', status: 'loading' })));
    controllersRef.current = Array.from({ length: PANELS_COUNT }, () => new AbortController());

    console.log('🎬 Starting', PANELS_COUNT, 'streams');
    for (let i = 0; i < PANELS_COUNT; i++) {
      const ctrl = controllersRef.current[i]!;
      startStream(i, finalPrompt, ctrl);
    }
  }, [prompt, startStream, mode, setStreams, handleImagesMode]);

  const saveToHistory = useCallback((promptText: string, results: StreamState[]) => {
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
            className={`relative w-[50px] h-[50px] top-0 left-0 bg-gray-800 hover:bg-gray-700 text-gray-300 p-3 rounded-lg shadow-lg cursor-pointer transition-all duration-300 hover:scale-105 ${isHistoryOpen ? 'hidden' : 'block'}`}
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
                className={`px-4 py-2 rounded-lg font-medium cursor-pointer transition-colors ${mode === 'html'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
              >
                🌐 HTML Preview
              </button>
              <button
                onClick={() => setMode('text')}
                className={`px-4 py-2 rounded-lg font-medium cursor-pointer transition-colors ${mode === 'text'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
              >
                📝 Text
              </button>
              {/* Кнопка Images с выпадающим списком */}
              <div className="relative">
                <button
                  onClick={() => setIsImagesDropdownOpen(!isImagesDropdownOpen)}
                  className={`px-4 py-2 rounded-lg font-medium cursor-pointer transition-colors ${mode === 'images'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                >
                  🖼️ {selectedImageModel || 'Images'}
                </button>

                {/* Выпадающий список */}
                {isImagesDropdownOpen && (
                  <div className="absolute top-full left-0 mt-1 bg-gray-700 rounded-lg shadow-lg z-50 min-w-[120px]">
                    {imageModels.map((model) => (
                      <button
                        key={model}
                        onClick={() => {
                          setSelectedImageModel(model);
                          setMode('images');
                          setParsedPrompts([]);
                          setIsImagesDropdownOpen(false);
                        }}
                        className={`w-full text-left px-4 py-2 text-sm text-gray-300 cursor-pointer hover:bg-gray-600 first:rounded-t-lg last:rounded-b-lg transition-colors ${selectedImageModel === model ? 'bg-gray-600' : ''
                          }`}
                      >
                        {model}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Форма */}
            <form onSubmit={onSubmit} className="flex flex-col items-center sm:flex-row gap-3 sm:gap-4">
              <div className="flex-1">
                <label className="sr-only" htmlFor="prompt">Prompt</label>
                <textarea
                  id="prompt"
                  placeholder={
                    mode === 'html'
                      ? 'Describe the HTML page you want...'
                      : mode === 'images'
                        ? 'Введите несколько промптов для изображений, разделенных абзацами...'
                        : 'Enter your prompt'
                  }
                  className="w-full border border-gray-700 rounded-lg px-4 py-4 min-h-[250px] sm:min-h-[120px] bg-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 custom-scrollbar"
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
                  disabled={!prompt.canSubmit || isStreaming || isParsingPrompts || isGeneratingImages}
                >
                  {isParsingPrompts
                    ? 'Parsing...'
                    : isGeneratingImages
                      ? 'Generating Images...'
                      : isStreaming
                        ? 'Generating...'
                        : mode === 'html'
                          ? 'Generate HTML'
                          : mode === 'images'
                            ? `Generate ${selectedImageModel || 'Images'}`
                            : 'Generate'
                  }
                </button>
              </div>
            </form>

            {/* Результаты */}
            <div className="w-full flex flex-col gap-4 mt-8">
              {mode === 'images' && parsedPrompts.length > 0 ? (
                // Специальный режим отображения для изображений
                <div className="space-y-6">
                  {imageResults.map((result: ImageGenerationResult, index: number) => (
                    <div key={index} className="flex gap-4">
                      {/* Блок с промптом - 30% ширины */}
                      <div className="w-[30%] bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium text-gray-300">Промпт #{index + 1}</h4>
                          <button
                            onClick={() => copyPromptToClipboard(result.prompt)}
                            className="text-gray-400 hover:text-gray-200 transition-colors p-1 rounded hover:bg-gray-700"
                            title="Копировать промпт"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                          </button>
                        </div>
                        <p className="text-gray-400 text-sm">{result.prompt}</p>

                        {/* Показываем переведенный промпт, если он был переведен */}
                        {result.translatedPrompt && 
                         result.wasTranslated && (
                          <div className="mt-2 p-2 bg-gray-700/50 rounded text-xs">
                            <div className="text-gray-500 mb-1">🌐 Translated:</div>
                            <div className="text-gray-300">{result.translatedPrompt}</div>
                          </div>
                        )}
                        <div className="mt-2 flex items-center gap-2">
                          <span className={`text-xs px-2 py-1 rounded ${result.status === 'loading'
                            ? 'bg-blue-900/40 text-blue-300'
                            : result.status === 'done'
                              ? 'bg-green-900/30 text-green-300'
                              : result.status === 'error'
                                ? 'bg-red-900/30 text-red-300'
                                : 'bg-gray-700 text-gray-300'
                            }`}>
                            {result.status === 'loading' ? 'Генерация...' :
                              result.status === 'done' ? 'Готово' :
                                result.status === 'error' ? 'Ошибка' : 'Ожидание'}
                          </span>
                          {selectedImageModel && (
                            <span className="text-xs px-2 py-1 rounded bg-gray-700 text-gray-300">
                              {selectedImageModel}
                            </span>
                          )}
                          {/* Индикатор славянских подсказок */}
                          {result.hasSlavicPrompts && (
                            <span className="text-xs px-2 py-1 rounded bg-blue-900/30 text-blue-300" title="Применены подсказки славянской внешности">
                              🇷🇺 Slavic
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Блоки с изображениями - 70% ширины */}
                      <div className="w-[70%] flex gap-4">
                        {result.status === 'loading' ? (
                          // Показываем загрузку
                          <>
                            <div className="flex-1 bg-gray-800/50 border border-gray-700 rounded-lg p-6 flex items-center justify-center min-h-[200px]">
                              <div className="text-center text-gray-500">
                                <div className="animate-spin text-4xl mb-2">⏳</div>
                                <p className="text-sm">Генерация...</p>
                              </div>
                            </div>
                            <div className="flex-1 bg-gray-800/50 border border-gray-700 rounded-lg p-6 flex items-center justify-center min-h-[200px]">
                              <div className="text-center text-gray-500">
                                <div className="animate-spin text-4xl mb-2">⏳</div>
                                <p className="text-sm">Генерация...</p>
                              </div>
                            </div>
                          </>
                        ) : result.status === 'error' ? (
                          // Показываем ошибку
                          <>
                            <div className="flex-1 bg-red-900/20 border border-red-700 rounded-lg p-6 flex items-center justify-center min-h-[200px]">
                              <div className="text-center text-red-400">
                                <div className="text-4xl mb-2">❌</div>
                                <p className="text-sm">Ошибка генерации</p>
                                <p className="text-xs text-red-500 mt-1">{result.error}</p>
                              </div>
                            </div>
                            <div className="flex-1 bg-red-900/20 border border-red-700 rounded-lg p-6 flex items-center justify-center min-h-[200px]">
                              <div className="text-center text-red-400">
                                <div className="text-4xl mb-2">❌</div>
                                <p className="text-sm">Ошибка генерации</p>
                                <p className="text-xs text-red-500 mt-1">{result.error}</p>
                              </div>
                            </div>
                          </>
                        ) : selectedImageModel === 'Imagen 4' ? (
                          // Показываем сгенерированные изображения для Imagen 4
                          <>
                            {result.images.slice(0, 2).map((image: GeneratedImage, imgIndex: number) => (
                              <div key={imgIndex} className="flex-1 bg-gray-800/50 border border-gray-700 rounded-lg p-2 flex flex-col min-h-[200px]">
                                {/* Кнопка скачивания */}
                                <div className="flex justify-end mb-2">
                                  <button
                                    onClick={() => downloadImage(
                                      image.imageBytes,
                                      image.mimeType,
                                      `image-${index + 1}-${imgIndex + 1}.${image.mimeType.split('/')[1] || 'png'}`
                                    )}
                                    className="text-gray-400 hover:text-gray-200 transition-colors p-1 rounded hover:bg-gray-700"
                                    title="Скачать изображение"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                  </button>
                                </div>

                                {/* Изображение */}
                                <div className="flex-1 flex items-center justify-center">
                                  <Image
                                    src={`data:${image.mimeType};base64,${image.imageBytes}`}
                                    alt={`Generated image ${index + 1}-${imgIndex + 1}`}
                                    width={300}
                                    height={300}
                                    className="max-w-full max-h-full object-contain rounded"
                                    unoptimized
                                  />
                                </div>
                              </div>
                            ))}
                            {result.images.length === 0 && (
                              <>
                                <div className="flex-1 bg-gray-800/50 border border-gray-700 rounded-lg p-6 flex items-center justify-center min-h-[200px]">
                                  <div className="text-center text-gray-500">
                                    <div className="text-4xl mb-2">🖼️</div>
                                    <p className="text-sm">Нет изображений</p>
                                  </div>
                                </div>
                                <div className="flex-1 bg-gray-800/50 border border-gray-700 rounded-lg p-6 flex items-center justify-center min-h-[200px]">
                                  <div className="text-center text-gray-500">
                                    <div className="text-4xl mb-2">🖼️</div>
                                    <p className="text-sm">Нет изображений</p>
                                  </div>
                                </div>
                              </>
                            )}
                          </>
                        ) : (
                          // Показываем заглушки для других моделей
                          <>
                            <div className="flex-1 bg-gray-800/50 border border-gray-700 rounded-lg p-6 flex items-center justify-center min-h-[200px]">
                              <div className="text-center text-gray-500">
                                <div className="text-4xl mb-2">🖼️</div>
                                <p className="text-sm">Изображение #{index + 1}-1</p>
                                <p className="text-xs text-gray-600 mt-1">Заглушка ({selectedImageModel})</p>
                              </div>
                            </div>
                            <div className="flex-1 bg-gray-800/50 border border-gray-700 rounded-lg p-6 flex items-center justify-center min-h-[200px]">
                              <div className="text-center text-gray-500">
                                <div className="text-4xl mb-2">🖼️</div>
                                <p className="text-sm">Изображение #{index + 1}-2</p>
                                <p className="text-xs text-gray-600 mt-1">Заглушка ({selectedImageModel})</p>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : mode === 'images' ? (
                // В режиме изображений, но промпты еще не парсились
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">🖼️</div>
                  <h3 className="text-xl font-semibold text-gray-300 mb-2">Режим генерации изображений</h3>
                  <p className="text-gray-500 mb-4">
                    Введите несколько промптов для изображений, разделенных абзацами
                  </p>
                  <p className="text-sm text-gray-600">
                    Каждый абзац будет обработан как отдельный промпт для генерации изображения
                  </p>
                  {selectedImageModel && (
                    <p className="text-sm text-blue-400 mt-2">
                      Выбрана модель: {selectedImageModel}
                    </p>
                  )}
                </div>
              ) : (
                // Обычный режим отображения для HTML и Text
                streams.map((s, i) => (
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
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}