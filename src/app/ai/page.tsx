'use client';

import { useServerHistory } from '@/hooks/useServerHistory';
import { useAuth } from '@/hooks/useAuth';
import { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import { usePromptInput } from '@/hooks/usePromtInput';
import { useStreams } from '@/hooks/useStreams';
import { useIframeHeight } from '@/hooks/useIframeHeight';
import { useCodePanels } from '@/hooks/useCodePanels';
import { useImageState } from '@/hooks/useImageState';
import { useImageGeneration } from '@/hooks/useImageGeneration';
import HistoryPanel from '../components/HistoryPanel';
import { StreamState, ImageGenerationResult, PANELS_COUNT, ServerHistoryItem, VideoGenerationResult } from '@/types/stream';
import { ModeSelector } from '../components/ModeSelector';
import { RequestCountSelector } from '../components/RequestCountSelector';
import { ImageSettings } from '../components/ImageSettings';
import { ImageResults } from '../components/ImageResults';
import { TextResults } from '../components/TextResults';
import { PromptForm } from '../components/PromptForm';
import { HistoryButton } from '../components/HistoryButton';
import { LoadingScreen } from '../components/LoadingScreen';
import { AccessDeniedScreen } from '../components/AccessDeniedScreen';
import { downloadImage, copyPromptToClipboard } from '@/utils/imageUtils';
import { downloadVideo } from '@/utils/videoUtils';
import { useVideoState } from '@/hooks/useVideoState';
import { useVideoGeneration } from '@/hooks/useVideoGeneration';
import { VideoSettings } from '../components/VideoSettings';
import { VideoResults } from '../components/VideoResults';
import { ImageIcon, VideoIcon } from '../components/Icons';
import { ResearchResults } from '../components/ResearchResults';

export default function AIPage() {
  const { user, loading } = useAuth();
  const prompt = usePromptInput({ minLen: 5, maxLen: 50000 });
  const [mode, setMode] = useState<'text' | 'html' | 'images' | 'videos' | 'research'>('html');
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isImagesDropdownOpen, setIsImagesDropdownOpen] = useState(false);
  const [selectedImageModel, setSelectedImageModel] = useState<string | null>(null);
  const [currentPromptValue, setCurrentPromptValue] = useState<string>('');
  const [requestCount, setRequestCount] = useState<number>(1);

  // Кастомные хуки
  const imageState = useImageState();
  const imageGeneration = useImageGeneration();
  const videoState = useVideoState();
  const videoGeneration = useVideoGeneration();

  // Получаем пользователя и серверную историю
  const { history: serverHistory, loadHistory, saveToHistory, deleteFromHistory, clearHistory } = useServerHistory(user?.id || '');

  // Хуки для управления streams
  const { getStreams, setStreams, markDone, appendDelta, updateGroundingMetadata } = useStreams();
  const streams = getStreams(mode);

  // Список нейросетей для генерации изображений
  const imageModels = ['Imagen 4', 'Flux', 'Banana', 'Ideogram'];

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
  const hasSavedImagesRef = useRef(false);
  const hasSavedVideosRef = useRef(false);

  // Отслеживаем предыдущий режим для очистки промпта при смене режима
  const prevModeRef = useRef<'text' | 'html' | 'images' | 'videos' | 'research'>('html');

  // Отслеживаем, был ли уже первый рендер
  const isFirstRenderRef = useRef(true);
  // Отслеживаем предыдущий режим для закрытия меню при смене режима
  const prevModeForMenuRef = useRef<'text' | 'html' | 'images' | 'videos' | 'research'>(mode);


  const isStreaming = useMemo(
    () => streams.some(s => s.status === 'loading'),
    [streams]
  );

  // Обработчики
  const abortOne = useCallback((index: number) => {
    const ctrl = controllersRef.current[index];
    if (ctrl && !ctrl.signal.aborted) {
      try {
        ctrl.abort();
      } catch (error) {
        // Игнорируем ошибки при отмене - контроллер мог уже быть отменен
        console.log('Controller abort handled', error);
      }
      controllersRef.current[index] = null;
    } else if (ctrl) {
      // Контроллер уже был отменен, просто очищаем ссылку
      controllersRef.current[index] = null;
    }
    setStreams(mode)(prev => {
      const next = [...prev];
      if (next[index]?.status === 'loading') {
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

  const loadFromHistory = useCallback((item: ServerHistoryItem) => {
    console.log('Loading from history:', item);

    prompt.setValue(item.prompt);

    if (mode === 'images' && item.results && Array.isArray(item.results)) {
      // Загружаем результаты изображений
      imageGeneration.setImageResults(item.results as ImageGenerationResult[]);
    } else if (mode === 'videos' && item.results && Array.isArray(item.results)) {
      // Загружаем результаты видео
      videoGeneration.setVideoResults(item.results as VideoGenerationResult[]);
    } else if (item.results && Array.isArray(item.results) && item.results.length > 0) {
      // Загружаем результаты text/html
      const resultsArray = item.results as StreamState[];
      const paddedResults = Array.from({ length: Math.max(PANELS_COUNT, resultsArray.length) }, (_, i) => {
        if (i < resultsArray.length) {
          return { ...resultsArray[i] };
        } else {
          return { text: '', status: 'idle' as const };
        }
      });

      setStreams(mode)(paddedResults);
    } else {
      setStreams(mode)(Array.from({ length: PANELS_COUNT }, () => ({ text: '', status: 'idle' })));
    }
  }, [prompt, setStreams, mode, imageGeneration, videoGeneration]);

  const deleteFromHistoryLocal = useCallback((id: string) => {
    const currentModel = mode === 'images' ? (selectedImageModel ?? undefined) : undefined;
    deleteFromHistory(id, mode, currentModel);
  }, [deleteFromHistory, mode, selectedImageModel]);

  const clearHistoryLocal = useCallback(async () => {
    const modelToClear = mode === 'images' ? (selectedImageModel ?? undefined) : undefined;
    await clearHistory(mode, modelToClear);

    // Очищаем результаты изображений и сбрасываем флаг
    if (mode === 'images') {
      imageGeneration.setImageResults([]);
      hasSavedImagesRef.current = false;
    }

    // Очищаем результаты видео и сбрасываем флаг
    if (mode === 'videos') {
      videoGeneration.setVideoResults([]);
      hasSavedVideosRef.current = false;
    }
  }, [clearHistory, mode, selectedImageModel, imageGeneration, videoGeneration]);

  const saveToHistoryLocal = useCallback(async (promptText: string, results: StreamState[]) => {
    console.log('Saving to server history:', promptText, results);

    // Фильтруем пустые потоки - сохраняем только те, которые имеют контент или завершены
    const streamsToSave = results.filter(s => 
      s.text.trim().length > 0 || s.status === 'done' || s.status === 'error'
    );

    await saveToHistory(
      promptText,
      mode,
      mode === 'images' ? (selectedImageModel || undefined) : undefined,
      streamsToSave
    );
  }, [saveToHistory, mode, selectedImageModel]);

  const handleResearchMode = useCallback(async (promptText: string, count: number) => {
    console.log('🔍 Starting research mode for prompt:', promptText, `with ${count} requests`);

    // Модифицируем промпт, добавляя инструкции для вывода HTML
    const researchPrompt = `${promptText}

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
- Use BEM methodology for class names
- Use information from your research to create accurate and up-to-date content`;

    const setStreamsFn = setStreams('research');

    // Инициализируем потоки для всех запросов
    setStreamsFn(prev => {
      const next = [...prev];
      for (let i = 0; i < count; i++) {
        next[i] = { text: '', status: 'loading' };
      }
      return next;
    });

    // Функция для запуска одного запроса по индексу
    const startResearchStream = (index: number) => {
      const controller = new AbortController();
      controllersRef.current[index] = controller;

      fetch('/api/ai/gemini/research', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt: researchPrompt }),
        signal: controller.signal
      })
        .then(response => {
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          return response.body?.getReader();
        })
        .then(reader => {
          if (!reader) {
            throw new Error('No reader available');
          }

          const decoder = new TextDecoder();
          let buffer = '';

          const readStream = (): Promise<void> => {
            return reader.read().then(({ done, value }) => {
              if (done) {
                markDone(index, 'research');
                controllersRef.current[index] = null;
                return;
              }

              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split('\n');
              buffer = lines.pop() || '';

              for (const line of lines) {
                if (line.trim()) {
                  try {
                    const data = JSON.parse(line);

                    if (data.delta) {
                      console.log(`📝 Received delta for research ${index}:`, data.delta.slice(0, 50) + '...');
                      appendDelta(index, data.delta, 'research');
                    } else if (data.groundingMetadata) {
                      console.log(`🔍 Received grounding metadata for research ${index}:`, JSON.stringify(data.groundingMetadata, null, 2));
                      updateGroundingMetadata(index, 'research', data.groundingMetadata);
                    } else if (data.done) {
                      console.log(`✅ Research ${index} completed`);
                      markDone(index, 'research');
                      controllersRef.current[index] = null;
                    } else if (data.error) {
                      throw new Error(data.error);
                    }
                  } catch (parseError) {
                    console.error(`Error parsing stream data for research ${index}:`, parseError);
                  }
                }
              }

              return readStream();
            });
          };

          return readStream();
        })
        .catch(error => {
          // Если запрос был отменен пользователем - не обрабатываем как ошибку
          if (error instanceof Error && (error.name === 'AbortError' || error.message === 'Aborted' || error.message.includes('aborted'))) {
            console.log(`Research stream ${index} aborted by user`);
            controllersRef.current[index] = null;
            // Обновляем статус на idle вместо error
            setStreamsFn(prev => {
              const next = [...prev];
              if (next[index]?.status === 'loading') {
                next[index] = { ...next[index], status: 'idle' };
              }
              return next;
            });
            return; // Выходим, не показываем ошибку
          }

          // Обрабатываем только реальные ошибки
          console.error(`Research generation error for index ${index}:`, error);
          setStreamsFn(prev => {
            const next = [...prev];
            if (next[index]) {
              next[index] = {
                ...next[index],
                status: 'error',
                error: error instanceof Error ? error.message : 'Unknown error'
              };
            }
            return next;
          });
          controllersRef.current[index] = null;
        });
    };

    // Запускаем несколько параллельных запросов
    for (let i = 0; i < count; i++) {
      startResearchStream(i);
    }
  }, [setStreams, appendDelta, markDone, updateGroundingMetadata]);

  const onSubmit = useCallback((e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!prompt.canSubmit) {
      prompt.setTouched(true);
      prompt.setError('Введите корректный промпт');
      return;
    }

    console.log('🎯 Starting generation with prompt:', prompt.value);

    setCurrentPromptValue(prompt.value);
    hasSavedRef.current = false;
    hasSavedImagesRef.current = false;

    if (mode === 'images') {
      imageGeneration.handleImagesMode(
        prompt.value,
        selectedImageModel,
        imageState.imageCount,
        imageState.aspectRatio,
        imageState.imagenModel,
        imageState.imageSize,
        prompt.setError
      );
      return;
    }

    if (mode === 'videos') {
      videoGeneration.handleVideosMode(
        prompt.value,
        videoState.selectedModel,
        videoState.resolution,
        videoState.modelVersion,
        videoState.duration,
        videoState.aspectRatio,
        videoState.referenceImages,
        videoState.videoCount,
        prompt.setError
      );
      return;
    }

    if (mode === 'research') {
      handleResearchMode(prompt.value, requestCount);
      return;
    }

    // Логика для text/html режимов с множественной генерацией
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

    // Инициализируем потоки для всех запросов
    setStreams(mode)(prev => {
      const next = [...prev];
      for (let i = 0; i < requestCount; i++) {
        next[i] = { text: '', status: 'loading' };
      }
      return next;
    });

    // Функция для запуска одного запроса по индексу
    const startStream = (index: number) => {
      const controller = new AbortController();
      controllersRef.current[index] = controller;

      fetch('/api/ai/gemini/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt: finalPrompt }),
        signal: controller.signal
      })
        .then(response => {
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          return response.body?.getReader();
        })
        .then(reader => {
          if (!reader) {
            throw new Error('No reader available');
          }

          const decoder = new TextDecoder();
          let buffer = '';

          const readStream = (): Promise<void> => {
            return reader.read().then(({ done, value }) => {
              if (done) {
                markDone(index, mode);
                controllersRef.current[index] = null;
                return;
              }

              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split('\n');
              buffer = lines.pop() || '';

              for (const line of lines) {
                if (line.trim()) {
                  try {
                    const data = JSON.parse(line);
                    if (data.delta) {
                      appendDelta(index, data.delta, mode);
                    } else if (data.done) {
                      markDone(index, mode);
                      controllersRef.current[index] = null;
                    } else if (data.error) {
                      throw new Error(data.error);
                    }
                  } catch (parseError) {
                    console.error(`Error parsing stream data for index ${index}:`, parseError);
                  }
                }
              }

              return readStream();
            });
          };

          return readStream();
        })
        .catch(error => {
          // Если запрос был отменен пользователем - не обрабатываем как ошибку
          if (error.name === 'AbortError' || error.message === 'Aborted' || (error instanceof Error && error.message.includes('aborted'))) {
            console.log(`Stream ${index} aborted by user`);
            controllersRef.current[index] = null;
            // Обновляем статус на idle вместо error
            setStreams(mode)(prev => {
              const next = [...prev];
              if (next[index]?.status === 'loading') {
                next[index] = { ...next[index], status: 'idle' };
              }
              return next;
            });
            return; // Выходим, не показываем ошибку
          }

          // Обрабатываем только реальные ошибки
          console.error(`Stream ${index} generation error:`, error);
          setStreams(mode)(prev => {
            const next = [...prev];
            if (next[index]) {
              next[index] = {
                ...next[index],
                status: 'error',
                error: error instanceof Error ? error.message : 'Unknown error'
              };
            }
            return next;
          });
          controllersRef.current[index] = null;
        });
    };

    // Запускаем несколько параллельных запросов
    for (let i = 0; i < requestCount; i++) {
      startStream(i);
    }
  }, [prompt, mode, selectedImageModel, imageState, imageGeneration, videoState, videoGeneration, setStreams, appendDelta, markDone, handleResearchMode, requestCount]);


  const onImageToVideoSubmit = useCallback(() => {
    if (!videoState.startingImage) {
      prompt.setError('Выберите стартовое изображение');
      return;
    }

    if (!prompt.canSubmit) {
      prompt.setTouched(true);
      prompt.setError('Введите корректный промпт');
      return;
    }

    // Вызываем логику генерации видео
    videoGeneration.handleVideosMode(
      prompt.value,
      videoState.selectedModel,
      videoState.resolution,
      videoState.modelVersion,
      videoState.duration,
      videoState.aspectRatio,
      videoState.referenceImages,
      videoState.videoCount,
      prompt.setError
    );
  }, [videoState, prompt, videoGeneration]);

  // Автоматически сохраняем результаты в историю после завершения генерации
  useEffect(() => {
    if (mode === 'images') {
      // Для режима изображений - отдельная логика
      const allDone = imageGeneration.imageResults.every(result => result.status === 'done' || result.status === 'error');
      const hasContent = imageGeneration.imageResults.some(result => result.images.length > 0);

      if (allDone && hasContent && imageGeneration.imageResults.length > 0 && !hasSavedImagesRef.current) {
        hasSavedImagesRef.current = true;
        console.log('🎨 Saving image results to server history:', imageGeneration.imageResults);

        // Сохраняем в серверную историю
        saveToHistory(
          prompt.value, // Используем оригинальный промпт
          'images',
          selectedImageModel || undefined,
          imageGeneration.imageResults
        );
      } else if (!allDone) {
        hasSavedImagesRef.current = false;
      }
    } else if (mode === 'videos') {
      const allDone = videoGeneration.videoResults.every(result => result.status === 'done' || result.status === 'error');
      const hasContent = videoGeneration.videoResults.some(result => result.video.videoBytes);

      if (allDone && hasContent && videoGeneration.videoResults.length > 0 && !hasSavedVideosRef.current) {
        hasSavedVideosRef.current = true;
        console.log('🎬 Saving video results to server history:', videoGeneration.videoResults);

        // Сохраняем в серверную историю
        saveToHistory(
          prompt.value, // Используем оригинальный промпт
          'videos',
          undefined, // Для videos не передаем модель - общая история для всех моделей
          videoGeneration.videoResults
        );
      } else if (!allDone) {
        hasSavedVideosRef.current = false;
      }
    } else if (mode === 'research') {
      // Для режима research - логика сохранения
      const streams = getStreams(mode);
      const allDone = streams.every(s => s.status === 'done' || s.status === 'error');
      const hasContent = streams.some(s => s.text);

      if (allDone && hasContent && !hasSavedRef.current && currentPromptValue) {
        hasSavedRef.current = true;
        console.log('🔍 Saving research results to server history:', streams);

        // Сохраняем в серверную историю
        saveToHistoryLocal(currentPromptValue, streams);
      } else if (!allDone) {
        hasSavedRef.current = false;
      }
    } else {
      // Для режимов text и html
      const streams = getStreams(mode);
      const allDone = streams.every(s => s.status === 'done' || s.status === 'error');
      const hasContent = streams.some(s => s.text);

      if (allDone && hasContent && !hasSavedRef.current && currentPromptValue) {
        hasSavedRef.current = true;
        console.log('📝 Saving text/html results to server history:', streams);

        // Сохраняем в серверную историю
        saveToHistoryLocal(currentPromptValue, streams);
      } else if (!allDone) {
        hasSavedRef.current = false;
      }
    }
  }, [imageGeneration.imageResults, videoGeneration.videoResults, streams, currentPromptValue, saveToHistoryLocal, mode, prompt.value, selectedImageModel, saveToHistory, getStreams, hasSavedRef, hasSavedImagesRef, hasSavedVideosRef]);

  // useEffect для загрузки истории по режиму
  useEffect(() => {
    if (user?.id) {
      // Для режима изображений загружаем историю только если выбрана модель
      if (mode === 'images' && !selectedImageModel) {
        return; // Не загружаем историю, если модель не выбрана
      }

      // Для режима видео загружаем историю независимо от модели (общая история)
      const modelToLoad = mode === 'images' ? (selectedImageModel ?? undefined) : undefined;
      loadHistory(mode, modelToLoad);
    }
  }, [user?.id, mode, selectedImageModel, loadHistory]);

  useEffect(() => {
    // Закрываем выпадающее меню изображений при реальной смене режима (не при первом рендере)
    if (prevModeForMenuRef.current !== mode && mode !== 'images' && isImagesDropdownOpen) {
      setIsImagesDropdownOpen(false);
    }

    // Сбрасываем выбранную модель изображений при переключении на text/html режимы
    if (mode !== 'images' && selectedImageModel !== null) {
      setSelectedImageModel(null);
    }

    // Сбрасываем флаги сохранения при смене режима
    if (mode !== 'images') {
      hasSavedImagesRef.current = false;
    }
    if (mode !== 'videos') {
      hasSavedVideosRef.current = false;
    }
    if (mode !== 'text' && mode !== 'html' && mode !== 'research') {
      hasSavedRef.current = false;
    }

    // Обновляем предыдущий режим
    prevModeForMenuRef.current = mode;
  }, [mode, selectedImageModel, isImagesDropdownOpen]);

  useEffect(() => {
    // Сбрасываем выбранную модель изображений при переключении на text/html режимы
    if (mode !== 'images' && selectedImageModel !== null) {
      setSelectedImageModel(null);
    }

    // Сбрасываем флаги сохранения при смене режима
    if (mode !== 'images') {
      hasSavedImagesRef.current = false;
    }
    if (mode !== 'videos') {
      hasSavedVideosRef.current = false;
    }
    if (mode !== 'text' && mode !== 'html' && mode !== 'research') {
      hasSavedRef.current = false;
    }
  }, [mode, selectedImageModel]);

  // Очищаем промпт при смене режима (но не при первой загрузке)
  useEffect(() => {
    // Пропускаем первый рендер
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      prevModeRef.current = mode;
      return;
    }

    // Если режим изменился, очищаем промпт и результаты
    if (prevModeRef.current !== mode) {
      prompt.reset();
      prompt.setError(null);

      // Очищаем результаты предыдущего режима
      const prevMode = prevModeRef.current;

      // Очищаем streams для режимов text/html/research
      if (prevMode === 'text' || prevMode === 'html' || prevMode === 'research') {
        setStreams(prevMode)(Array.from({ length: PANELS_COUNT }, () => ({ text: '', status: 'idle' })));
      }
      
      // Очищаем результаты изображений
      if (prevMode === 'images') {
        imageGeneration.setImageResults([]);
      }
      
      // Очищаем результаты видео
      if (prevMode === 'videos') {
        videoGeneration.setVideoResults([]);
      }
    }

    // Обновляем предыдущий режим
    prevModeRef.current = mode;
  }, [mode, prompt, setStreams, imageGeneration, videoGeneration]);

  if (loading) return <LoadingScreen />;
  if (!user) return <AccessDeniedScreen />;

  return (
    <main className="min-h-screen">
      <div className="w-full mx-auto w-full py-6 sm:py-10 px-4">
        <div className="flex gap-6">
          <HistoryButton
            isOpen={isHistoryOpen}
            onToggle={() => setIsHistoryOpen(!isHistoryOpen)}
          />

          <HistoryPanel
            mode={mode}
            history={serverHistory}
            isOpen={isHistoryOpen}
            onClose={() => setIsHistoryOpen(false)}
            onLoadFromHistory={loadFromHistory}
            onDeleteFromHistory={deleteFromHistoryLocal}
            onClearHistory={clearHistoryLocal}
          />

          <div className="flex-1 min-w-0">
            <ModeSelector
              mode={mode}
              onModeChange={setMode}
              selectedImageModel={selectedImageModel}
              onImageModelChange={setSelectedImageModel}
              isImagesDropdownOpen={isImagesDropdownOpen}
              onImagesDropdownToggle={() => setIsImagesDropdownOpen(!isImagesDropdownOpen)}
              imageModels={imageModels}
            />

            <RequestCountSelector
              mode={mode}
              requestCount={requestCount}
              imageCount={imageState.imageCount}
              videoCount={videoState.videoCount}
              onRequestCountChange={setRequestCount}
              onImageCountChange={imageState.setImageCount}
              onVideoCountChange={videoState.setVideoCount}
            />

            {mode === 'images' && (
              <ImageSettings
                aspectRatio={imageState.aspectRatio}
                imagenModel={imageState.imagenModel}
                imageSize={imageState.imageSize}
                onAspectRatioChange={imageState.setAspectRatio}
                onImagenModelChange={imageState.setImagenModel}
                onImageSizeChange={imageState.setImageSize}
              />
            )}

            {mode === 'videos' && (
              <VideoSettings
                generationMode={videoState.generationMode}
                resolution={videoState.resolution}
                aspectRatio={videoState.aspectRatio}
                selectedModel={videoState.selectedModel}
                duration={videoState.duration}
                startingImage={videoState.startingImage}
                onModeChange={videoState.setGenerationMode}
                onResolutionChange={videoState.setResolution}
                onAspectRatioChange={videoState.setAspectRatio}
                onModelChange={videoState.setSelectedModel}
                onDurationChange={videoState.setDuration}
                onSetStartingImage={videoState.setStartingImageFile}
                onClearStartingImage={videoState.clearStartingImage}
              />
            )}

            {/* Показываем PromptForm только для текстового режима или других режимов */}
            {(mode !== 'videos' || videoState.generationMode === 'text-to-video') && (
              <PromptForm
                prompt={{
                  ...prompt,
                  error: prompt.error || undefined
                }}
                mode={mode}
                onSubmit={onSubmit}
                isStreaming={isStreaming}
                isParsingPrompts={imageGeneration.isParsingPrompts}
                isGeneratingImages={imageGeneration.isGeneratingImages}
              />
            )}

            {mode === 'videos' && videoState.generationMode === 'image-to-video' && (
              <div className="flex justify-end">
                <button
                  onClick={() => {
                    if (!videoState.startingImage) {
                      prompt.setError('Выберите стартовое изображение');
                      return;
                    }
                    onImageToVideoSubmit();
                  }}
                  disabled={!videoState.startingImage || isStreaming}
                  className={`px-6 py-3 rounded-lg font-medium transition-colors ${!videoState.startingImage || isStreaming
                    ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                >
                  {isStreaming ? 'Генерация...' : 'Сгенерировать видео'}
                </button>
              </div>
            )}

            <div className="w-full flex flex-col gap-4 mt-8">
              {mode === 'images' && imageGeneration.imageResults.length > 0 ? (
                <ImageResults
                  imageResults={imageGeneration.imageResults}
                  selectedImageModel={selectedImageModel}
                  imageCount={imageState.imageCount}
                  onDownloadImage={downloadImage}
                  onCopyPrompt={copyPromptToClipboard}
                  onAbort={imageGeneration.abortImageGeneration}
                />
              ) : mode === 'images' ? (
                <div className="text-center py-12">
                  <ImageIcon className="w-16 h-16 mx-auto text-gray-400" />
                  <h3 className="text-xl font-semibold text-gray-300 mb-2">Режим генерации изображений</h3>
                  <p className="text-gray-500 mb-4">
                    Введите несколько промптов для изображений, разделенных абзацами
                  </p>
                  <p className="text-sm text-gray-600">
                    Каждый абзац будет обработан как отдельный промпт для генерации изображения
                  </p>
                  {selectedImageModel && (
                    <p className="text-sm text-blue-400 mt-2">
                      Выбрана модель: {selectedImageModel} | Изображений на промпт: {imageState.imageCount}
                    </p>
                  )}
                </div>
              ) : mode === 'videos' && videoGeneration.videoResults.length > 0 ? (
                <VideoResults
                  videoResults={videoGeneration.videoResults}
                  onDownloadVideo={downloadVideo}
                  onCopyPrompt={copyPromptToClipboard}
                  onAbort={videoGeneration.abortVideoGeneration}
                />
              ) : mode === 'videos' ? (
                <div className="text-center py-12">
                  <VideoIcon className="w-16 h-16 mx-auto text-gray-400" />
                  <h3 className="text-xl font-semibold text-gray-300 mb-2">Режим генерации видео</h3>
                  <p className="text-gray-500 mb-4">
                    Введите промпт или несколько промптов для генерации видео, разделенных абзацами
                  </p>
                  <p className="text-sm text-gray-600">
                    Каждый абзац будет обработан как отдельный промпт для генерации видео
                  </p>
                  {videoState.selectedModel && (
                    <p className="text-sm text-blue-400 mt-2">
                      Выбрана модель: {videoState.selectedModel} | Длительность: 4-8с (автоматически) | Разрешение: {videoState.resolution}
                    </p>
                  )}
                </div>
              ) : mode === 'research' ? (
                <ResearchResults
                  streams={streams}
                  editingStates={editingStates}
                  openCodePanels={openCodePanels}
                  iframeHeights={iframeHeights}
                  onToggleEdit={toggleEdit}
                  onUpdateText={updateText}
                  onCopyToClipboard={copyToClipboard}
                  onAbort={abortOne}
                  onToggleCodePanel={toggleCodePanel}
                  onAdjustIframeHeight={adjustIframeHeight}
                />
              ) : (
                <TextResults
                  streams={streams}
                  mode={mode}
                  editingStates={editingStates}
                  openCodePanels={openCodePanels}
                  iframeHeights={iframeHeights}
                  onToggleEdit={toggleEdit}
                  onUpdateText={updateText}
                  onCopyToClipboard={copyToClipboard}
                  onAbort={abortOne}
                  onToggleCodePanel={toggleCodePanel}
                  onAdjustIframeHeight={adjustIframeHeight}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}