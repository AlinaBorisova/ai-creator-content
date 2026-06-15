import { useState, useCallback, useRef } from 'react';
import { ImageGenerationResult, GeneratedImage } from '@/types/stream';

export function useImageGeneration() {
  const [imageResults, setImageResults] = useState<ImageGenerationResult[]>([]);
  const [isGeneratingImages, setIsGeneratingImages] = useState(false);
  const [parsedPrompts, setParsedPrompts] = useState<string[]>([]);
  const [isParsingPrompts, setIsParsingPrompts] = useState(false);

  // ref для хранения AbortController'ов
  const controllersRef = useRef<Array<AbortController | null>>([]);

  const generateImages = useCallback(async (
    promptText: string,
    imageCount: number,
    aspectRatio: string,
    imagenModel: string,
    imageSize: string,
    signal?: AbortSignal
  ): Promise<{ images: GeneratedImage[], translation?: { original: string, translated: string, language: string, wasTranslated: boolean, hasSlavicPrompts: boolean } }> => {
    try {
      const response = await fetch('/api/ai/imagen', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: promptText,
          numberOfImages: imageCount,
          imageSize: imagenModel === 'imagen-4.0-fast-generate-001' ? '1K' : imageSize,
          aspectRatio: aspectRatio,
          modelVersion: imagenModel
        }),
        signal
      });

      if (!response.ok) {
        // Пытаемся прочитать детали ошибки из ответа
        let errorMessage = 'Failed to generate images';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
          // Если есть детали, добавляем их к сообщению
          if (errorData.details) {
            if (typeof errorData.details === 'string') {
              try {
                const parsed = JSON.parse(errorData.details);
                if (parsed.error?.message) {
                  errorMessage = parsed.error.message;
                }
              } catch {
                // Если не JSON, используем как есть
              }
            } else if (errorData.details.error?.message) {
              errorMessage = errorData.details.error.message;
            }
          }
        } catch {
          // Если не удалось распарсить JSON, пытаемся прочитать как текст
          // Клонируем response, так как тело уже было прочитано
          try {
            const clonedResponse = response.clone();
            const errorText = await clonedResponse.text();
            if (errorText) {
              try {
                const parsed = JSON.parse(errorText);
                if (parsed.error?.message) {
                  errorMessage = parsed.error.message;
                }
              } catch {
                errorMessage = errorText.slice(0, 200); // Берем первые 200 символов
              }
            }
          } catch {
            // Если не удалось распарсить, используем дефолтное сообщение
          }
        }

        // Улучшаем сообщение для ошибок квоты
        if (errorMessage.includes('quota') || errorMessage.includes('Quota exceeded')) {
          errorMessage = 'Превышен дневной лимит запросов к Imagen API. Лимит: 70 запросов в день. Попробуйте завтра или используйте другую модель (Flux, Banana, Ideogram).';
        } else if (errorMessage.includes('location is not supported')) {
          errorMessage = 'Imagen API недоступен в вашем регионе. Используйте другую модель (Flux, Banana, Ideogram).';
        }

        throw new Error(errorMessage);
      }

      // ✅ Только если response.ok === true, читаем успешный ответ
      const data = await response.json();
      return {
        images: data.images || [],
        translation: data.translation
      };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw error; // Пробрасываем AbortError дальше
      }
      console.error('Error generating images:', error);
      throw error;
    }
  }, []);

  const handleImagesMode = useCallback(async (
    promptValue: string,
    selectedImageModel: string | null,
    imageCount: number,
    aspectRatio: string,
    imagenModel: string,
    imageSize: string,
    geminiImageResolution: '1K' | '2K' | '4K',
    onError: (error: string) => void
  ) => {
    if (!promptValue.trim()) return;

    const prompts = promptValue
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    if (prompts.length === 0) {
      onError('Введите хотя бы один промпт');
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
    const isNanoBananaPro = selectedImageModel === 'Nano Banana PRO';

    // Инициализируем контроллеры для каждого промпта
    controllersRef.current = prompts.map(() => new AbortController());

    if (isImagen4) {
      setIsGeneratingImages(true);

      try {
        const results: ImageGenerationResult[] = [];

        for (let i = 0; i < prompts.length; i++) {
          const promptText = prompts[i];
          const controller = controllersRef.current[i];
          // Проверяем, не был ли запрос отменен
          if (!controller || controller.signal.aborted) {
            results.push({
              prompt: promptText,
              images: [],
              status: 'idle',
              translatedPrompt: undefined,
              hasSlavicPrompts: false,
              wasTranslated: false
            });
            setImageResults([...results]);
            continue;
          }

          console.log(`🎨 Generating images for prompt ${i + 1}:`, promptText);

          try {
            const result = await generateImages(promptText, imageCount, aspectRatio, imagenModel, imageSize, controller.signal);

            // Проверяем, не был ли запрос отменен во время выполнения
            if (controller.signal.aborted) {
              results.push({
                prompt: promptText,
                images: [],
                status: 'idle',
                translatedPrompt: undefined,
                hasSlavicPrompts: false,
                wasTranslated: false
              });
            } else {
              results.push({
                prompt: promptText,
                images: result.images,
                status: 'done',
                translatedPrompt: result.translation?.translated || promptText,
                hasSlavicPrompts: result.translation?.hasSlavicPrompts || false,
                wasTranslated: result.translation?.wasTranslated || false
              });
            }
          } catch (error) {
            if (error instanceof Error && (error.name === 'AbortError' || error.message.includes('aborted'))) {
              console.log(`Image generation ${i} aborted by user`);
              results.push({
                prompt: promptText,
                images: [],
                status: 'idle',
                translatedPrompt: undefined,
                hasSlavicPrompts: false,
                wasTranslated: false
              });
            } else {
              const errorMessage = error instanceof Error ? error.message : 'Unknown error';
              console.error(`Error generating images for prompt ${i + 1}:`, error);

              // Показываем ошибку пользователю через onError callback (только для первого промпта)
              if (i === 0) {
                onError(errorMessage);
              }

              results.push({
                prompt: promptText,
                images: [],
                status: 'error',
                error: errorMessage,
                translatedPrompt: undefined,
                hasSlavicPrompts: false,
                wasTranslated: false
              });
            }
          }

          setImageResults([...results]);
        }
      } catch (error) {
        console.error('Error in image generation process:', error);
      } finally {
        setIsGeneratingImages(false);
        setIsParsingPrompts(false);
        controllersRef.current = [];
      }
    } else if (isNanoBananaPro) {
      setIsGeneratingImages(true);

      try {
        const results: ImageGenerationResult[] = [];

        for (let i = 0; i < prompts.length; i++) {
          const promptText = prompts[i];
          const controller = controllersRef.current[i];

          if (!controller || controller.signal.aborted) {
            results.push({
              prompt: promptText,
              images: [],
              status: 'idle',
              translatedPrompt: undefined,
              hasSlavicPrompts: false,
              wasTranslated: false
            });
            setImageResults([...results]);
            continue;
          }

          console.log(`🎨 Generating images with Nano Banana PRO for prompt ${i + 1}:`, promptText);

          try {
            const response = await fetch('/api/ai/gemini/image', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                prompt: promptText,
                aspectRatio: aspectRatio,
                resolution: geminiImageResolution,
                numberOfImages: imageCount,
              }),
              signal: controller.signal
            });

            if (!response.ok) {
              let errorMessage = 'Failed to generate images';
              try {
                const errorData = await response.json();
                errorMessage = errorData.error || errorMessage;
              } catch {
                // Если не удалось распарсить, используем дефолтное сообщение
              }
              throw new Error(errorMessage);
            }

            const data = await response.json();

            if (controller.signal.aborted) {
              results.push({
                prompt: promptText,
                images: [],
                status: 'idle',
                translatedPrompt: undefined,
                hasSlavicPrompts: false,
                wasTranslated: false
              });
            } else {
              results.push({
                prompt: promptText,
                images: data.images || [],
                status: 'done',
                translatedPrompt: data.translation?.translated || promptText,
                hasSlavicPrompts: data.translation?.hasSlavicPrompts || false,
                wasTranslated: data.translation?.wasTranslated || false
              });
            }
          } catch (error) {
            if (error instanceof Error && (error.name === 'AbortError' || error.message.includes('aborted'))) {
              console.log(`Image generation ${i} aborted by user`);
              results.push({
                prompt: promptText,
                images: [],
                status: 'idle',
                translatedPrompt: undefined,
                hasSlavicPrompts: false,
                wasTranslated: false
              });
            } else {
              const errorMessage = error instanceof Error ? error.message : 'Unknown error';
              console.error(`Error generating images for prompt ${i + 1}:`, error);

              if (i === 0) {
                onError(errorMessage);
              }

              results.push({
                prompt: promptText,
                images: [],
                status: 'error',
                error: errorMessage,
                translatedPrompt: undefined,
                hasSlavicPrompts: false,
                wasTranslated: false
              });
            }
          }

          setImageResults([...results]);
        }
      } catch (error) {
        console.error('Error in image generation process:', error);
      } finally {
        setIsGeneratingImages(false);
        setIsParsingPrompts(false);
        controllersRef.current = [];
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
        controllersRef.current = [];
      }, 1000);
    }
  }, [generateImages]);

  // Функция для отмены генерации конкретного изображения
  const abortImageGeneration = useCallback((index: number) => {
    const controller = controllersRef.current[index];
    if (controller && !controller.signal.aborted) {
      try {
        controller.abort();
      } catch (error) {
        console.log('Controller abort handled', error);
      }
      controllersRef.current[index] = null;

      // Обновляем статус на idle
      setImageResults(prev => {
        const next = [...prev];
        if (next[index]?.status === 'loading') {
          next[index] = { ...next[index], status: 'idle' };
        }
        return next;
      });
    }
  }, []);

  return {
    imageResults,
    setImageResults,
    isGeneratingImages,
    parsedPrompts,
    isParsingPrompts,
    handleImagesMode,
    abortImageGeneration
  };
}