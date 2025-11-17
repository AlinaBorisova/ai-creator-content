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
        throw new Error('Failed to generate images');
      }

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