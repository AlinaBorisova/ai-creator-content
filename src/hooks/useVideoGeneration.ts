import { useState, useCallback } from 'react';
import { VideoGenerationResult, GeneratedVideo, ReferenceImage } from '@/types/stream';
import { VideoModel } from '@/types/stream';

export function useVideoGeneration() {
  const [videoResults, setVideoResults] = useState<VideoGenerationResult[]>([]);
  const [isGeneratingVideos, setIsGeneratingVideos] = useState(false);
  const [parsedPrompts, setParsedPrompts] = useState<string[]>([]);
  const [isParsingPrompts, setIsParsingPrompts] = useState(false);

  const generateVideo = useCallback(async (
    promptText: string,
    modelVersion: string,
    resolution: string,
    durationSeconds: string,
    aspectRatio: string,
    referenceImages: ReferenceImage[] = []
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
        })
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
        await new Promise(resolve => setTimeout(resolve, 10000)); // 10 секунд

        const statusResponse = await fetch('/api/ai/veo/status', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ operation: operationId })
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
            body: JSON.stringify({ videoUri })
          });

          if (!downloadResponse.ok) {
            const errorData = await downloadResponse.json();
            throw new Error(errorData.error || 'Failed to download video');
          }

          const downloadData = await downloadResponse.json();
          // Получаем реальную длительность видео на клиенте
          const videoBlob = new Blob([Buffer.from(downloadData.videoBytes, 'base64')], { type: 'video/mp4' });
          const videoUrl = URL.createObjectURL(videoBlob);

          return new Promise((resolve) => {
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
            video.src = videoUrl;
          });
        }

        attempts++;
      }

      throw new Error('Video generation timeout');

    } catch (error) {
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
    const initialResults: VideoGenerationResult[] = prompts.map(promptText => ({
      prompt: promptText,
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
    }));
    setVideoResults(initialResults);

    const isVeo = selectedVideoModel === 'Veo 3.1' || selectedVideoModel === 'Veo 3.1 Fast';

    if (isVeo) {
      setIsGeneratingVideos(true);

      try {
        const results: VideoGenerationResult[] = [];

        for (let i = 0; i < prompts.length; i++) {
          const promptText = prompts[i];
          console.log(`🎬 Generating video for prompt ${i + 1}:`, promptText);

          try {
            const result = await generateVideo(
              promptText, 
              modelVersion, 
              resolution, 
              durationSeconds,
              aspectRatio,
              referenceImages
            );

            results.push({
              prompt: promptText,
              video: result.video,
              status: 'done',
              translatedPrompt: result.translation?.translated || promptText,
              hasSlavicPrompts: result.translation?.hasSlavicPrompts || false,
              wasTranslated: result.translation?.wasTranslated || false
            });
          } catch (error) {
            console.error(`Error generating video for prompt ${i + 1}:`, error);
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
              translatedPrompt: undefined,
              hasSlavicPrompts: false,
              wasTranslated: false
            });
          }

          setVideoResults([...results]);
        }
      } catch (error) {
        console.error('Error in video generation process:', error);
      } finally {
        setIsGeneratingVideos(false);
        setIsParsingPrompts(false);
      }
    } else {
      // Убираем заглушку - всегда генерируем видео
      console.log('🎬 Generating video for model:', selectedVideoModel);
      setIsGeneratingVideos(true);

      try {
        const results: VideoGenerationResult[] = [];

        for (let i = 0; i < prompts.length; i++) {
          const promptText = prompts[i];
          console.log(`🎬 Generating video for prompt ${i + 1}:`, promptText);

          try {
            const result = await generateVideo(
              promptText, 
              modelVersion, 
              resolution, 
              durationSeconds,
              aspectRatio
            );

            results.push({
              prompt: promptText,
              video: result.video,
              status: 'done',
              translatedPrompt: result.translation?.translated || promptText,
              hasSlavicPrompts: result.translation?.hasSlavicPrompts || false,
              wasTranslated: result.translation?.wasTranslated || false
            });
          } catch (error) {
            console.error(`Error generating video for prompt ${i + 1}:`, error);
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
              translatedPrompt: undefined,
              hasSlavicPrompts: false,
              wasTranslated: false
            });
          }

          setVideoResults([...results]);
        }
      } catch (error) {
        console.error('Error in video generation process:', error);
      } finally {
        setIsGeneratingVideos(false);
        setIsParsingPrompts(false);
      }
    }
  }, [generateVideo]);

  return {
    videoResults,
    setVideoResults,
    isGeneratingVideos,
    parsedPrompts,
    isParsingPrompts,
    handleVideosMode
  };
}