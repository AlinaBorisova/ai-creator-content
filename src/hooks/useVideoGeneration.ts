import { useState, useCallback, useRef } from 'react';
import { VideoGenerationResult, GeneratedVideo, ReferenceImage } from '@/types/stream';
import { VideoModel } from '@/types/stream';

export function useVideoGeneration() {
  const [videoResults, setVideoResults] = useState<VideoGenerationResult[]>([]);
  const [isGeneratingVideos, setIsGeneratingVideos] = useState(false);
  const [parsedPrompts, setParsedPrompts] = useState<string[]>([]);
  const [isParsingPrompts, setIsParsingPrompts] = useState(false);

  // ref для хранения AbortController'ов
  const controllersRef = useRef<Array<AbortController | null>>([]);
  // Ref для хранения флагов отмены polling'а
  const abortFlagsRef = useRef<Array<boolean>>([]);

  const generateVideo = useCallback(async (
    promptText: string,
    modelVersion: string,
    resolution: string,
    durationSeconds: string,
    aspectRatio: string,
    referenceImages: ReferenceImage[] = [],
    signal?: AbortSignal,
    abortFlag?: { current: boolean }
  ): Promise<{ video: GeneratedVideo, translation?: { translated: string; hasSlavicPrompts: boolean; wasTranslated: boolean } }> => {
    try {
      // Подготавливаем изображения для отправки
      const imagesForApi = await Promise.all(
        referenceImages.map(async (img) => {
          const base64 = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.readAsDataURL(img.file);
          });
          return {
            file: base64,
            name: img.name,
            size: img.size
          };
        })
      );

      // Запуск генерации
      const response = await fetch('/api/ai/veo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: promptText,
          modelVersion,
          durationSeconds,
          aspectRatio,
          resolution,
          referenceImages: imagesForApi
        }),
        signal
      });

      if (!response.ok) {
        throw new Error('Failed to start video generation');
      }

      const data = await response.json();
      const operationId = data.operation;

      // Polling статуса
      let attempts = 0;
      const maxAttempts = 60; // 10 минут максимум

      while (attempts < maxAttempts) {
        // Проверяем флаг отмены перед каждой итерацией
        if (signal?.aborted || (abortFlag && abortFlag.current)) {
          throw new Error('Aborted');
        }

        await new Promise(resolve => setTimeout(resolve, 10000)); // 10 секунд

        // Проверяем флаг отмены после ожидания
        if (signal?.aborted || (abortFlag && abortFlag.current)) {
          throw new Error('Aborted');
        }

        const statusResponse = await fetch('/api/ai/veo/status', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ operation: operationId }),
          signal
        });

        if (!statusResponse.ok) {
          throw new Error('Failed to check status');
        }

        const statusData = await statusResponse.json();

        if (statusData.done) {
          if (statusData.error) {
            console.error('Video generation error:', statusData.error);
            const errorMessage = typeof statusData.error === 'string'
              ? statusData.error
              : statusData.error.message || JSON.stringify(statusData.error);
            throw new Error(`Video generation failed: ${errorMessage}`);
          }

          const videoUri = statusData.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri;
          if (!videoUri) {
            throw new Error('No video URI in response');
          }

          const downloadResponse = await fetch('/api/ai/veo/download', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ videoUri }),
            signal
          });

          if (!downloadResponse.ok) {
            const errorData = await downloadResponse.json();
            throw new Error(errorData.error || 'Failed to download video');
          }

          const downloadData = await downloadResponse.json();
          // Получаем реальную длительность видео на клиенте
          const videoBlob = new Blob([Buffer.from(downloadData.videoBytes, 'base64')], { type: 'video/mp4' });
          const videoUrl = URL.createObjectURL(videoBlob);

          return new Promise((resolve, reject) => {
            // Проверяем отмену перед созданием video элемента
            if (signal?.aborted || (abortFlag && abortFlag.current)) {
              URL.revokeObjectURL(videoUrl);
              reject(new Error('Aborted'));
              return;
            }

            const video = document.createElement('video');
            video.onloadedmetadata = () => {
              const realDuration = Math.round(video.duration);
              URL.revokeObjectURL(videoUrl);
              resolve({
                video: {
                  videoBytes: downloadData.videoBytes,
                  mimeType: downloadData.mimeType,
                  duration: realDuration,
                  resolution: resolution,
                  aspectRatio: '16:9'
                },
                translation: data.translation
              });
            };
            video.onerror = () => {
              URL.revokeObjectURL(videoUrl);
              reject(new Error('Failed to load video metadata'));
            };
            video.src = videoUrl;
          });
        }

        attempts++;
      }

      throw new Error('Video generation timeout');

    } catch (error) {
      if (error instanceof Error && (error.name === 'AbortError' || error.message === 'Aborted')) {
        throw error; // Пробрасываем AbortError дальше
      }
      console.error('Error generating video:', error);
      throw error;
    }
  }, []);

  const handleVideosMode = useCallback(async (
    promptValue: string,
    selectedVideoModel: VideoModel | null,
    resolution: string,
    modelVersion: string,
    durationSeconds: string,
    aspectRatio: string,
    referenceImages: ReferenceImage[],
    videoCount: number,
    onError: (error: string) => void
  ) => {
    if (!promptValue.trim()) return;

    const prompts = promptValue
      .split('\n\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    if (prompts.length === 0) {
      onError('Введите хотя бы один промпт');
      return;
    }

    setIsParsingPrompts(true);
    setParsedPrompts(prompts);

    // Инициализируем результаты генерации
    // Для каждого промпта создаем videoCount записей
    const initialResults: VideoGenerationResult[] = [];
    for (let promptIndex = 0; promptIndex < prompts.length; promptIndex++) {
      for (let videoIndex = 0; videoIndex < videoCount; videoIndex++) {
        initialResults.push({
          prompt: prompts[promptIndex],
          video: {
            videoBytes: '',
            mimeType: 'video/mp4',
            duration: 0,
            resolution: resolution,
            aspectRatio: aspectRatio
          },
          status: 'loading',
          translatedPrompt: undefined,
          hasSlavicPrompts: false,
          wasTranslated: false,
          model: selectedVideoModel || 'Veo 2'
        });
      }
    }
    setVideoResults(initialResults);

    // Инициализируем контроллеры и флаги отмены для каждого видео
    const totalVideos = prompts.length * videoCount;
    controllersRef.current = Array.from({ length: totalVideos }, () => new AbortController());
    abortFlagsRef.current = Array.from({ length: totalVideos }, () => false);

    const isVeo = selectedVideoModel === 'Veo 3.1' || selectedVideoModel === 'Veo 3.1 Fast';

    if (isVeo) {
      setIsGeneratingVideos(true);

      try {
        const results: VideoGenerationResult[] = [];

        for (let promptIndex = 0; promptIndex < prompts.length; promptIndex++) {
          const promptText = prompts[promptIndex];
          console.log(`🎬 Generating ${videoCount} videos for prompt ${promptIndex + 1}:`, promptText);

          // Генерируем videoCount видео для каждого промпта
          for (let videoIndex = 0; videoIndex < videoCount; videoIndex++) {
            const resultIndex = promptIndex * videoCount + videoIndex;
            const controller = controllersRef.current[resultIndex];
            const abortFlag = { current: abortFlagsRef.current[resultIndex] };
            
            // Проверяем, не был ли запрос отменен
            if (!controller || controller.signal.aborted || abortFlag.current) {
              results.push({
                prompt: promptText,
                video: {
                  videoBytes: '',
                  mimeType: 'video/mp4',
                  duration: 0,
                  resolution: resolution,
                  aspectRatio: aspectRatio
                },
                status: 'idle',
                translatedPrompt: undefined,
                hasSlavicPrompts: false,
                wasTranslated: false,
                model: selectedVideoModel || 'Veo 2'
              });
              setVideoResults([...results]);
              continue;
            }
            
            try {
              console.log(`🎬 Generating video ${videoIndex + 1}/${videoCount} for prompt ${promptIndex + 1}`);
              const result = await generateVideo(
                promptText, 
                modelVersion, 
                resolution, 
                durationSeconds,
                aspectRatio,
                referenceImages,
                controller.signal,
                abortFlag
              );

               // Проверяем, не был ли запрос отменен во время выполнения
               if (controller.signal.aborted || abortFlag.current) {
                results.push({
                  prompt: promptText,
                  video: {
                    videoBytes: '',
                    mimeType: 'video/mp4',
                    duration: 0,
                    resolution: resolution,
                    aspectRatio: aspectRatio
                  },
                  status: 'idle',
                  translatedPrompt: undefined,
                  hasSlavicPrompts: false,
                  wasTranslated: false,
                  model: selectedVideoModel || 'Veo 2'
                });
              } else {
                results.push({
                  prompt: promptText,
                  video: result.video,
                  status: 'done',
                  translatedPrompt: result.translation?.translated || promptText,
                  hasSlavicPrompts: result.translation?.hasSlavicPrompts || false,
                  wasTranslated: result.translation?.wasTranslated || false,
                  model: selectedVideoModel || 'Veo 2'
                });
              }
            } catch (error) {
              // Если запрос был отменен - не обрабатываем как ошибку
              if (error instanceof Error && (error.name === 'AbortError' || error.message === 'Aborted' || error.message.includes('aborted'))) {
                console.log(`Video generation ${resultIndex} aborted by user`);
                results.push({
                  prompt: promptText,
                  video: {
                    videoBytes: '',
                    mimeType: 'video/mp4',
                    duration: 0,
                    resolution: resolution,
                    aspectRatio: aspectRatio
                  },
                  status: 'idle',
                  translatedPrompt: undefined,
                  hasSlavicPrompts: false,
                  wasTranslated: false,
                  model: selectedVideoModel || 'Veo 2'
                });
              } else {
                console.error(`Error generating video ${videoIndex + 1}/${videoCount} for prompt ${promptIndex + 1}:`, error);
                results.push({
                  prompt: promptText,
                  video: {
                    videoBytes: '',
                    mimeType: 'video/mp4',
                    duration: 0,
                    resolution: resolution,
                    aspectRatio: aspectRatio
                  },
                  status: 'error',
                  error: error instanceof Error ? error.message : 'Unknown error',
                  translatedPrompt: undefined,
                  hasSlavicPrompts: false,
                  wasTranslated: false,
                  model: selectedVideoModel || 'Veo 2'
                });
              }
            }

            // Обновляем результаты после каждого видео
            setVideoResults([...results]);
          }
        }
      } catch (error) {
        console.error('Error in video generation process:', error);
      } finally {
        setIsGeneratingVideos(false);
        setIsParsingPrompts(false);
        controllersRef.current = [];
        abortFlagsRef.current = [];
      }
    } else {
      // Для других моделей
      console.log('🎬 Generating video for model:', selectedVideoModel);
      setIsGeneratingVideos(true);

      try {
        const results: VideoGenerationResult[] = [];

        for (let promptIndex = 0; promptIndex < prompts.length; promptIndex++) {
          const promptText = prompts[promptIndex];
          console.log(`🎬 Generating ${videoCount} videos for prompt ${promptIndex + 1}:`, promptText);

          // Генерируем videoCount видео для каждого промпта
          for (let videoIndex = 0; videoIndex < videoCount; videoIndex++) {
            const resultIndex = promptIndex * videoCount + videoIndex;
            const controller = controllersRef.current[resultIndex];
            const abortFlag = { current: abortFlagsRef.current[resultIndex] };
            
            // Проверяем, не был ли запрос отменен
            if (!controller || controller.signal.aborted || abortFlag.current) {
              results.push({
                prompt: promptText,
                video: {
                  videoBytes: '',
                  mimeType: 'video/mp4',
                  duration: 0,
                  resolution: resolution,
                  aspectRatio: aspectRatio
                },
                status: 'idle',
                translatedPrompt: undefined,
                hasSlavicPrompts: false,
                wasTranslated: false,
                model: selectedVideoModel || 'Veo 2'
              });
              setVideoResults([...results]);
              continue;
            }

            try {
              console.log(`🎬 Generating video ${videoIndex + 1}/${videoCount} for prompt ${promptIndex + 1}`);
              const result = await generateVideo(
                promptText, 
                modelVersion, 
                resolution, 
                durationSeconds,
                aspectRatio,
                undefined,
                controller.signal,
                abortFlag
              );

              // Проверяем, не был ли запрос отменен во время выполнения
              if (controller.signal.aborted || abortFlag.current) {
                results.push({
                  prompt: promptText,
                  video: {
                    videoBytes: '',
                    mimeType: 'video/mp4',
                    duration: 0,
                    resolution: resolution,
                    aspectRatio: aspectRatio
                  },
                  status: 'idle',
                  translatedPrompt: undefined,
                  hasSlavicPrompts: false,
                  wasTranslated: false,
                  model: selectedVideoModel || 'Veo 2'
                });
              } else {
                results.push({
                  prompt: promptText,
                  video: result.video,
                  status: 'done',
                  translatedPrompt: result.translation?.translated || promptText,
                  hasSlavicPrompts: result.translation?.hasSlavicPrompts || false,
                  wasTranslated: result.translation?.wasTranslated || false,
                  model: selectedVideoModel || 'Veo 2'
                });
              }
            } catch (error) {
              // Если запрос был отменен - не обрабатываем как ошибку
              console.error(`Error generating video ${videoIndex + 1}/${videoCount} for prompt ${promptIndex + 1}:`, error);
              if (error instanceof Error && (error.name === 'AbortError' || error.message === 'Aborted' || error.message.includes('aborted'))) {
                console.log(`Video generation ${resultIndex} aborted by user`);
                results.push({
                  prompt: promptText,
                  video: {
                    videoBytes: '',
                    mimeType: 'video/mp4',
                    duration: 0,
                    resolution: resolution,
                    aspectRatio: aspectRatio
                  },
                  status: 'idle',
                  translatedPrompt: undefined,
                  hasSlavicPrompts: false,
                  wasTranslated: false,
                  model: selectedVideoModel || 'Veo 2'
                });
              } else {
                console.error(`Error generating video ${videoIndex + 1}/${videoCount} for prompt ${promptIndex + 1}:`, error);
                results.push({
                  prompt: promptText,
                  video: {
                    videoBytes: '',
                    mimeType: 'video/mp4',
                    duration: 0,
                    resolution: resolution,
                    aspectRatio: aspectRatio
                  },
                  status: 'error',
                  error: error instanceof Error ? error.message : 'Unknown error',
                  translatedPrompt: undefined,
                  hasSlavicPrompts: false,
                  wasTranslated: false,
                  model: selectedVideoModel || 'Veo 2'
                });
              }
            }

            // Обновляем результаты после каждого видео
            setVideoResults([...results]);
          }
        }
      } catch (error) {
        console.error('Error in video generation process:', error);
      } finally {
        setIsGeneratingVideos(false);
        setIsParsingPrompts(false);
        controllersRef.current = [];
        abortFlagsRef.current = [];
      }
    }
  }, [generateVideo]);

  // Функция для отмены генерации конкретного видео
  const abortVideoGeneration = useCallback((index: number) => {
    const controller = controllersRef.current[index];
    if (controller && !controller.signal.aborted) {
      try {
        controller.abort();
      } catch (error) {
        console.log('Controller abort handled', error);
      }
      controllersRef.current[index] = null;
    }
    
    // Устанавливаем флаг отмены для polling'а
    if (abortFlagsRef.current[index] !== undefined) {
      abortFlagsRef.current[index] = true;
    }
    
    // Обновляем статус на idle
    setVideoResults(prev => {
      const next = [...prev];
      if (next[index]?.status === 'loading') {
        next[index] = { ...next[index], status: 'idle' };
      }
      return next;
    });
  }, []);

  return {
    videoResults,
    setVideoResults,
    isGeneratingVideos,
    parsedPrompts,
    isParsingPrompts,
    handleVideosMode,
    abortVideoGeneration
  };
}