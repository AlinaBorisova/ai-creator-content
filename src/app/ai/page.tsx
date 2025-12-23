'use client';

import { useSEOArticle } from '@/hooks/useSEOArticle';
import { SEOArticleForm } from '../components/SEOArticleForm';
import { useServerHistory } from '@/hooks/useServerHistory';
import { useAuth } from '@/hooks/useAuth';
import { useCallback, useMemo, useState, useEffect } from 'react';
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
import { PromptForm } from '../components/PromptForm';
import { HistoryButton } from '../components/HistoryButton';
import { LoadingScreen } from '../components/LoadingScreen';
import { AccessDeniedScreen } from '../components/AccessDeniedScreen';
import { downloadImage, copyPromptToClipboard } from '@/utils/imageUtils';
import { downloadVideo } from '@/utils/videoUtils';
import { useVideoState } from '@/hooks/useVideoState';
import { useVideoGeneration } from '@/hooks/useVideoGeneration';
import { VideoSettings } from '../components/VideoSettings';
import { GeminiModelSelector, GeminiModelVersion } from '../components/GeminiModelSelector';
import { useTextGeneration } from '@/hooks/useTextGeneration';
import { useHistoryAutoSave } from '@/hooks/useHistoryAutoSave';
import { useModeManagement } from '@/hooks/useModeManagement';
import { ModeContent } from '../components/ModeContent';

export default function AIPage() {
  const { user, loading } = useAuth();
  const prompt = usePromptInput({ minLen: 5, maxLen: 50000 });
  const [mode, setMode] = useState<'text' | 'html' | 'images' | 'videos' | 'research' | 'seo-article'>('html');
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isImagesDropdownOpen, setIsImagesDropdownOpen] = useState(false);
  const [selectedImageModel, setSelectedImageModel] = useState<string | null>(null);
  const [selectedGeminiModel, setSelectedGeminiModel] = useState<GeminiModelVersion>('gemini-2.5-pro');
  const [currentPromptValue, setCurrentPromptValue] = useState<string>('');
  const [requestCount, setRequestCount] = useState<number>(1);

  // Кастомные хуки
  const imageState = useImageState();
  const imageGeneration = useImageGeneration();
  const videoState = useVideoState();
  const videoGeneration = useVideoGeneration();
  const seoArticle = useSEOArticle();

  // Получаем пользователя и серверную историю
  const { history: serverHistory, loading: historyLoading, loadHistory, saveToHistory, deleteFromHistory, clearHistory, loadHistoryItem } = useServerHistory(user?.id || '');

  // Хуки для управления streams
  const { getStreams, setStreams, markDone, appendDelta, updateGroundingMetadata } = useStreams();
  const streams = getStreams(mode);

  // Список нейросетей для генерации изображений
  const imageModels = ['Imagen 4'];

  // Хук для управления высотой iframe
  const { iframeHeights, adjustIframeHeight } = useIframeHeight(mode, streams);

  // Хук для управления панелями кода
  const { openCodePanels, toggleCodePanel } = useCodePanels(mode, iframeHeights);

  // Состояние редактирования для каждого блока
  const [editingStates, setEditingStates] = useState<boolean[]>(
    () => Array.from({ length: PANELS_COUNT }, () => false)
  );

  // Хук для генерации текста/HTML/research
  const { generateText, abortStream, retryStream } = useTextGeneration({
    mode,
    setStreams,
    appendDelta,
    markDone,
    updateGroundingMetadata,
    selectedGeminiModel,
  });

  // Хук для автоматического сохранения в историю
  const { hasSavedRef, hasSavedImagesRef, hasSavedVideosRef } = useHistoryAutoSave({
    mode,
    currentPromptValue,
    streams,
    imageResults: imageGeneration.imageResults,
    videoResults: videoGeneration.videoResults,
    saveToHistory,
    selectedImageModel,
    getStreams,
  });

  // Хук для управления режимом
  useModeManagement({
    mode,
    prompt,
    setStreams,
    imageGeneration,
    videoGeneration,
    seoArticle,
    selectedImageModel,
    setIsImagesDropdownOpen,
    hasSavedRefs: {
      hasSavedRef,
      hasSavedImagesRef,
      hasSavedVideosRef,
    },
  });

  const isStreaming = useMemo(
    () => {
      if (mode === 'seo-article') {
        return seoArticle.isGeneratingText || seoArticle.isGeneratingImages;
      }
      return streams.some(s => s.status === 'loading');
    },
    [streams, mode, seoArticle.isGeneratingText, seoArticle.isGeneratingImages]
  );

  // Обработчики

  const handleRetry = useCallback((index: number) => {
    // retryStream использует сохраненный промпт из promptsRef, не нужно передавать параметры
    retryStream(index);
  }, [retryStream]);

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

  const loadFromHistory = useCallback(async (item: ServerHistoryItem) => {
    console.log('Loading from history:', item);

    prompt.setValue(item.prompt);

    const fullItem = await loadHistoryItem(item.id);

    if (!fullItem) {
      console.warn('Failed to load full history item, using cached data without results');
      if (mode === 'images') {
        imageGeneration.setImageResults([]);
      } else if (mode === 'videos') {
        videoGeneration.setVideoResults([]);
      } else {
        setStreams(mode)(Array.from({ length: PANELS_COUNT }, () => ({ text: '', status: 'idle' })));
      }
      return;
    }

    if (mode === 'images' && fullItem.results && Array.isArray(fullItem.results)) {
      imageGeneration.setImageResults(fullItem.results as ImageGenerationResult[]);
    } else if (mode === 'videos' && fullItem.results && Array.isArray(fullItem.results)) {
      videoGeneration.setVideoResults(fullItem.results as VideoGenerationResult[]);
    } else if (fullItem.results && Array.isArray(fullItem.results) && fullItem.results.length > 0) {
      const resultsArray = fullItem.results as StreamState[];
      const paddedResults = Array.from({ length: Math.max(PANELS_COUNT, resultsArray.length) }, (_, i) => {
        if (i < resultsArray.length) {
          return { ...resultsArray[i] };
        } else {
          return { text: '', status: 'idle' as const };
        }
      });

      setStreams(mode)(paddedResults);
    } else {
      if (mode === 'images') {
        imageGeneration.setImageResults([]);
      } else if (mode === 'videos') {
        videoGeneration.setVideoResults([]);
      } else {
        setStreams(mode)(Array.from({ length: PANELS_COUNT }, () => ({ text: '', status: 'idle' })));
      }
    }
  }, [prompt, setStreams, mode, imageGeneration, videoGeneration, loadHistoryItem]);

  const deleteFromHistoryLocal = useCallback((id: string) => {
    const currentModel = mode === 'images' ? (selectedImageModel ?? undefined) : undefined;
    deleteFromHistory(id, mode, currentModel);
  }, [deleteFromHistory, mode, selectedImageModel]);

  const clearHistoryLocal = useCallback(async () => {
    const modelToClear = mode === 'images' ? (selectedImageModel ?? undefined) : undefined;
    await clearHistory(mode, modelToClear);

    if (mode === 'images') {
      imageGeneration.setImageResults([]);
      hasSavedImagesRef.current = false;
    }

    if (mode === 'videos') {
      videoGeneration.setVideoResults([]);
      hasSavedVideosRef.current = false;
    }
  }, [clearHistory, mode, selectedImageModel, imageGeneration, videoGeneration, hasSavedImagesRef, hasSavedVideosRef]);

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
      generateText(prompt.value, requestCount, true);
      return;
    }

    if (mode === 'seo-article') {
      return;
    }

    // Логика для text/html режимов
    generateText(prompt.value, requestCount, false);
  }, [prompt, mode, selectedImageModel, imageState, imageGeneration, videoState, videoGeneration, generateText, requestCount, hasSavedRef, hasSavedImagesRef]);

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

  // useEffect для загрузки истории по режиму
  useEffect(() => {
    if (user?.id && isHistoryOpen) {
      if (mode === 'images' && !selectedImageModel) {
        return;
      }

      if (mode === 'seo-article') {
        return;
      }

      const modelToLoad = mode === 'images' ? (selectedImageModel ?? undefined) : undefined;

      const timeoutId = setTimeout(() => {
        loadHistory(mode, modelToLoad);
      }, 100);

      return () => clearTimeout(timeoutId);
    }
  }, [user?.id, mode, selectedImageModel, isHistoryOpen, loadHistory]);

  if (loading) return <LoadingScreen />;
  if (!user) return <AccessDeniedScreen />;

  return (
    <main className="min-h-screen">
      <div className="w-full mx-auto w-full py-6 sm:py-10 px-4 md:px-6">
        <div className="flex gap-2 sm:gap-4 md:gap-6">
          <HistoryButton
            isOpen={isHistoryOpen}
            onToggle={() => setIsHistoryOpen(!isHistoryOpen)}
          />

          <HistoryPanel
            mode={mode}
            history={serverHistory}
            loading={historyLoading}
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

            {(mode === 'text' || mode === 'html' || mode === 'research') && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Версия модели Gemini
                </label>
                <GeminiModelSelector
                  selectedModel={selectedGeminiModel}
                  onModelChange={setSelectedGeminiModel}
                  disabled={isStreaming}
                />
              </div>
            )}

            {mode === 'seo-article' ? (
              <SEOArticleForm
                onGenerate={(promptText, htmlTemplate, imageResolution, modelVersion) => {
                  const topicMatch = promptText.match(/тема:\s*\[([^\]]+)\]/i);
                  const queryMatch = promptText.match(/запросу:\s*\[([^\]]+)\]/i);

                  seoArticle.generateArticleText(
                    promptText,
                    topicMatch ? topicMatch[1] : undefined,
                    queryMatch ? queryMatch[1] : undefined,
                    htmlTemplate,
                    imageResolution,
                    modelVersion
                  );
                }}
                isStreaming={seoArticle.isGeneratingText || seoArticle.isGeneratingImages}
                isParsingPrompts={false}
                isGeneratingImages={seoArticle.isGeneratingImages}
                onAbort={() => {
                  seoArticle.abortTextGeneration();
                  seoArticle.abortAll();
                }}
              />
            ) : (mode !== 'videos' || videoState.generationMode === 'text-to-video') && (
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
              <ModeContent
                mode={mode}
                streams={streams}
                imageResults={imageGeneration.imageResults}
                videoResults={videoGeneration.videoResults}
                articleResult={seoArticle.articleResult}
                editingStates={editingStates}
                openCodePanels={openCodePanels}
                iframeHeights={iframeHeights}
                selectedImageModel={selectedImageModel}
                imageCount={imageState.imageCount}
                videoState={{
                  selectedModel: videoState.selectedModel,
                  resolution: videoState.resolution,
                  videoCount: videoState.videoCount,
                }}
                onToggleEdit={toggleEdit}
                onUpdateText={updateText}
                onCopyToClipboard={copyToClipboard}
                onAbort={abortStream}
                onToggleCodePanel={toggleCodePanel}
                onAdjustIframeHeight={adjustIframeHeight}
                onDownloadImage={downloadImage}
                onCopyPrompt={copyPromptToClipboard}
                onDownloadVideo={downloadVideo}
                onAbortImageGeneration={imageGeneration.abortImageGeneration}
                onAbortVideoGeneration={videoGeneration.abortVideoGeneration}
                onRegenerateImage={seoArticle.regenerateImage}
                onRegenerateSingleImage={seoArticle.regenerateSingleImage}
                onAbortImageGenerationSEO={seoArticle.abortImageGeneration}
                onRetry={handleRetry}
              />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}