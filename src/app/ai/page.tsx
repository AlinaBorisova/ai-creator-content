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
//import { VideoModel } from '@/types/stream';

export default function AIPage() {
  const { user, loading } = useAuth();
  const prompt = usePromptInput({ minLen: 5, maxLen: 50000 });
  const [mode, setMode] = useState<'text' | 'html' | 'images' | 'videos'>('html');
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isImagesDropdownOpen, setIsImagesDropdownOpen] = useState(false);
  const [selectedImageModel, setSelectedImageModel] = useState<string | null>(null);
  const [currentPromptValue, setCurrentPromptValue] = useState<string>('');
  //const [isVideosDropdownOpen, setIsVideosDropdownOpen] = useState(false);
  //const [selectedVideoModel] = useState<string | null>(null);
  const [requestCount, setRequestCount] = useState<number>(1);
  // const [isVideosDropdownOpen, setIsVideosDropdownOpen] = useState(false);
  // const [selectedVideoModel, setSelectedVideoModel] = useState<VideoModel | null>('Veo 2');
  // const videoModels: VideoModel[] = ['Veo 2', 'Veo 3', 'Veo 3 Fast', 'Veo 3.1', 'Veo 3.1 Fast'];



  // Кастомные хуки
  const imageState = useImageState();
  const imageGeneration = useImageGeneration();
  const videoState = useVideoState();
  const videoGeneration = useVideoGeneration();

  // Получаем пользователя и серверную историю
  const { history: serverHistory, loadHistory, saveToHistory, deleteFromHistory, clearHistory } = useServerHistory(user?.id || '');

  // Хуки для управления streams
  const { getStreams, setStreams, markDone, appendDelta } = useStreams();
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

  const isStreaming = useMemo(
    () => streams.some(s => s.status === 'loading'),
    [streams]
  );

  // Обработчики (сохраняем критическую логику)
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
        body: JSON.stringify({
          prompt: p,
          requestIndex: index
        }),
        signal: ctrl.signal,
      });

      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }

      const reader = res.body?.getReader();
      if (!reader) {
        throw new Error('No reader available');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.trim()) {
              try {
                const parsed = JSON.parse(line);
                if (parsed.delta) {
                  appendDelta(index, parsed.delta, mode);
                } else if (parsed.done) {
                  markDone(index, mode);
                  return;
                }
              } catch {
                console.warn('Failed to parse data:', line);
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    } catch (err) {
      console.error(`Stream ${index} error:`, err);
      setStreams(mode)(prev => {
        const next = [...prev];
        next[index] = { ...next[index], status: 'error', error: err instanceof Error ? err.message : 'Unknown error' };
        return next;
      });
    }
  }, [appendDelta, markDone, setStreams, mode]);

  // Добавляем недостающие функции
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
    deleteFromHistory(id);
  }, [deleteFromHistory]);

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

    await saveToHistory(
      promptText,
      mode,
      mode === 'images' ? (selectedImageModel || undefined) : undefined,
      results
    );
  }, [saveToHistory, mode, selectedImageModel]);

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
        prompt.setError
      );
      return;
    }

    // Логика для text/html режимов
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

    setStreams(mode)(Array.from({ length: requestCount }, () => ({ text: '', status: 'loading' })));
    controllersRef.current = Array.from({ length: requestCount }, () => new AbortController());

    for (let i = 0; i < requestCount; i++) {
      const ctrl = controllersRef.current[i]!;
      startStream(i, finalPrompt, ctrl);
    }

    prompt.reset();
  }, [
    imageGeneration,
    imageState.aspectRatio,
    imageState.imageCount,
    imageState.imageSize,
    imageState.imagenModel,
    mode,
    prompt,
    requestCount,
    selectedImageModel,
    setStreams,
    startStream,
    videoGeneration,
    videoState.referenceImages,
    videoState.resolution,
    videoState.modelVersion,
    videoState.selectedModel,
    videoState.aspectRatio,
    videoState.duration
  ]);

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
          videoState.selectedModel, // Используем выбранную модель
          videoGeneration.videoResults
        );
      } else if (!allDone) {
        hasSavedVideosRef.current = false;
      }
    } else {
      // Для режимов text и html - логика сохранения
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
  }, [imageGeneration.imageResults, videoGeneration.videoResults, streams, currentPromptValue, saveToHistoryLocal, mode, prompt.value, selectedImageModel, saveToHistory, getStreams, hasSavedRef, hasSavedImagesRef, hasSavedVideosRef, videoState.selectedModel]);

  // useEffect для загрузки истории по режиму
  useEffect(() => {
    if (user?.id) {
      // Для режима изображений загружаем историю только если выбрана модель
      if (mode === 'images' && !selectedImageModel) {
        return; // Не загружаем историю, если модель не выбрана
      }
      
      // Для режима видео загружаем историю независимо от модели
      const modelToLoad = mode === 'images' ? (selectedImageModel ?? undefined) : undefined;
      loadHistory(mode, modelToLoad);
    }
  }, [user?.id, mode, selectedImageModel, videoState.selectedModel, loadHistory]);

  useEffect(() => {
    // Сбрасываем выбранную модель изображений при переключении на text/html режимы
    if (mode !== 'images' && selectedImageModel !== null) {
      setSelectedImageModel(null);
    }
    // Сбрасываем выбранную модель видео при переключении на другие режимы
    // if (mode !== 'videos' && selectedVideoModel !== null) {
    //   setSelectedVideoModel(null);
    // }

    // Сбрасываем флаги сохранения при смене режима
    if (mode !== 'images') {
      hasSavedImagesRef.current = false;
    }
    if (mode !== 'videos') {
      hasSavedVideosRef.current = false;
    }
    if (mode !== 'text' && mode !== 'html') {
      hasSavedRef.current = false;
    }
  }, [mode, selectedImageModel]);

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
            // selectedVideoModel={selectedVideoModel}
            // onVideoModelChange={setSelectedVideoModel}
            // isVideosDropdownOpen={isVideosDropdownOpen}
            // onVideosDropdownToggle={() => setIsVideosDropdownOpen(!isVideosDropdownOpen)}
            // videoModels={videoModels}
            />

            <RequestCountSelector
              mode={mode}
              requestCount={requestCount}
              imageCount={imageState.imageCount}
              onRequestCountChange={setRequestCount}
              onImageCountChange={imageState.setImageCount}
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
                requestCount={requestCount}
                selectedImageModel={selectedImageModel}
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
                  //parsedPrompts={videoGeneration.parsedPrompts}
                  onDownloadVideo={downloadVideo}
                  onCopyPrompt={copyPromptToClipboard}
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