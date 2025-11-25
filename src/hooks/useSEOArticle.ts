import { useState, useCallback, useRef } from 'react';
import { SEOArticleResult, ImagePlaceholder, GeneratedImage } from '@/types/stream';
import { extractImagePrompts, updateImagePlaceholderInHTML } from '@/utils/seoArticleUtils';
import { optimizeImage } from '@/utils/imageUtils';
import { ImageResolution } from '@/app/components/SEOArticleForm';
import { GeminiModelVersion } from '@/lib/gemini';

export function useSEOArticle() {
  const [articleResult, setArticleResult] = useState<SEOArticleResult | null>(null);
  const [isGeneratingText, setIsGeneratingText] = useState(false);
  const [isGeneratingImages, setIsGeneratingImages] = useState(false);

  const textControllerRef = useRef<AbortController | null>(null);
  const imageControllersRef = useRef<Map<string, AbortController>>(new Map());

  /**
   * Извлекает первый и последний абзацы из HTML контента
   */
  const extractFirstAndLastParagraphs = useCallback((htmlContent: string): { first: string; last: string } => {
    // Создаем временный DOM элемент для парсинга
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlContent;

    // Находим все параграфы
    const paragraphs = tempDiv.querySelectorAll('p');

    let firstParagraph = '';
    let lastParagraph = '';

    if (paragraphs.length > 0) {
      // Первый параграф
      firstParagraph = paragraphs[0].textContent || paragraphs[0].innerText || '';

      // Последний параграф
      if (paragraphs.length > 1) {
        lastParagraph = paragraphs[paragraphs.length - 1].textContent || paragraphs[paragraphs.length - 1].innerText || '';
      } else {
        lastParagraph = firstParagraph;
      }
    }

    return { first: firstParagraph.trim(), last: lastParagraph.trim() };
  }, []);

  /**
   * Вставляет сгенерированный контент в HTML шаблон
   */
  const insertContentIntoTemplate = useCallback((
    htmlContent: string,
    htmlTemplate: string
  ): string => {
    if (!htmlTemplate || !htmlTemplate.trim()) {
      // Если шаблона нет, возвращаем просто контент
      return htmlContent;
    }

    let finalHTML = htmlTemplate;

    // Извлекаем первый и последний абзацы
    const { first, last } = extractFirstAndLastParagraphs(htmlContent);

    // Извлекаем тему из промпта (если есть)
    // Это можно улучшить, передавая тему отдельно
    const topicMatch = htmlContent.match(/<h[1-6][^>]*>([^<]+)<\/h[1-6]>/i);
    const topic = topicMatch ? topicMatch[1] : '';

    // Заменяем маркеры - делаем замену более гибкой, учитывая возможные пробелы и переносы строк вокруг маркера
    // Используем \s* для обработки любых пробелов (включая переносы строк, табы и т.д.) вокруг маркера

    // Заменяем основной маркер контента (может быть на отдельной строке с пробелами)
    // \s* означает ноль или более пробельных символов (включая \n, \r, \t, пробелы)
    finalHTML = finalHTML.replace(/\s*\[Сюда вставить весь сгенерированный текст\]\s*/g, htmlContent);

    // Заменяем маркер первого абзаца
    finalHTML = finalHTML.replace(/\s*\[Сюда вставить Первый абзац статьи\]\s*/g, first || '');

    // Заменяем маркер последнего абзаца
    finalHTML = finalHTML.replace(/\s*\[Сюда вставить Последний абзац статьи\]\s*/g, last || '');

    // Заменяем маркер темы
    finalHTML = finalHTML.replace(/\s*\[Сюда вставить тему\]\s*/g, topic);

    // Логирование для отладки
    const mainMarkerFound = /\s*\[Сюда вставить весь сгенерированный текст\]\s*/.test(htmlTemplate);
    const firstMarkerFound = /\s*\[Сюда вставить Первый абзац статьи\]\s*/.test(htmlTemplate);
    const lastMarkerFound = /\s*\[Сюда вставить Последний абзац статьи\]\s*/.test(htmlTemplate);
    const topicMarkerFound = /\s*\[Сюда вставить тему\]\s*/.test(htmlTemplate);

    const mainMarkerReplaced = !finalHTML.includes('[Сюда вставить весь сгенерированный текст]');
    const firstMarkerReplaced = !finalHTML.includes('[Сюда вставить Первый абзац статьи]');
    const lastMarkerReplaced = !finalHTML.includes('[Сюда вставить Последний абзац статьи]');
    const topicMarkerReplaced = !finalHTML.includes('[Сюда вставить тему]');

    console.log('🔍 insertContentIntoTemplate:', {
      templateLength: htmlTemplate.length,
      contentLength: htmlContent.length,
      mainMarker: {
        found: mainMarkerFound,
        replaced: mainMarkerReplaced,
        raw: htmlTemplate.includes('[Сюда вставить весь сгенерированный текст]')
      },
      firstMarker: {
        found: firstMarkerFound,
        replaced: firstMarkerReplaced,
        raw: htmlTemplate.includes('[Сюда вставить Первый абзац статьи]')
      },
      lastMarker: {
        found: lastMarkerFound,
        replaced: lastMarkerReplaced,
        raw: htmlTemplate.includes('[Сюда вставить Последний абзац статьи]')
      },
      topicMarker: {
        found: topicMarkerFound,
        replaced: topicMarkerReplaced,
        raw: htmlTemplate.includes('[Сюда вставить тему]')
      },
      firstParagraph: first?.substring(0, 50),
      lastParagraph: last?.substring(0, 50),
      topic: topic,
      finalHTMLLength: finalHTML.length,
      wasReplaced: finalHTML !== htmlTemplate
    });

    return finalHTML;
  }, [extractFirstAndLastParagraphs]);

  /**
   * Генерирует все изображения для статьи
   */
  const generateAllImages = useCallback(async (
    htmlContent: string,
    placeholders: ImagePlaceholder[],
    imageResolution?: ImageResolution
  ) => {
    setIsGeneratingImages(true);

    // Обновляем статусы всех placeholder'ов
    setArticleResult(prev => prev ? {
      ...prev,
      imagePlaceholders: placeholders.map(p => ({ ...p, status: 'generating' }))
    } : null);

    // Генерируем изображения для каждого placeholder'а параллельно
    const generationPromises = placeholders.map(async (placeholder) => {
      const controller = new AbortController();
      imageControllersRef.current.set(placeholder.id, controller);

      try {
        // Получаем разрешение из параметра или используем дефолтное
        const resolution = imageResolution || { width: 1408, height: 768, label: 'Дзен', aspectRatio: '16:9' };

        const response = await fetch('/api/ai/imagen', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            prompt: placeholder.prompt,
            numberOfImages: placeholder.imageCount,
            imageSize: '1K',
            aspectRatio: resolution.aspectRatio,
            modelVersion: 'imagen-4.0-generate-001'
          }),
          signal: controller.signal
        });

        if (!response.ok) {
          throw new Error(`Failed to generate images: ${response.status}`);
        }

        const data = await response.json();
        let images: GeneratedImage[] = data.images || [];

        // Оптимизируем изображения сразу после получения
        if (images.length > 0) {
          console.log('🔄 Optimizing images...');
          images = await Promise.all(
            images.map(async (img) => {
              try {
                // Используем разрешение из параметра функции (уже получено выше)
                const optimized = await optimizeImage(img.imageBytes, img.mimeType, 0.65);
                return {
                  ...img,
                  imageBytes: optimized.imageBytes,
                  mimeType: optimized.mimeType
                };
              } catch (error) {
                console.error('Error optimizing image, using original:', error);
                return img;
              }
            })
          );
          console.log('✅ Images optimized');
        }
        
        // Обновляем placeholder с изображениями
        setArticleResult(prev => {
          if (!prev) return null;

          const updatedPlaceholders = prev.imagePlaceholders.map(p =>
            p.id === placeholder.id
              ? { ...p, images, status: 'done' as const }
              : p
          );

          // Проверяем, все ли изображения сгенерированы
          const allDone = updatedPlaceholders.every(p =>
            p.status === 'done' || p.status === 'error'
          );

          // Вставляем изображения в HTML
          let updatedHTML = prev.htmlContent;
          if (images.length > 0) {
            updatedHTML = updateImagePlaceholderInHTML(
              updatedHTML,
              placeholder.id,
              { ...placeholder, images, status: 'done' }
            );
          }

          // Обновляем finalHTML если есть шаблон
          const updatedFinalHTML = prev.htmlTemplate && prev.htmlTemplate.trim()
            ? insertContentIntoTemplate(updatedHTML, prev.htmlTemplate)
            : updatedHTML;

          if (allDone) {
            console.log('🖼️ All images generated:', {
              htmlContentLength: updatedHTML.length,
              htmlTemplateLength: prev.htmlTemplate?.length || 0,
              finalHTMLLength: updatedFinalHTML.length,
              hasTemplate: !!prev.htmlTemplate
            });
          }

          return {
            ...prev,
            htmlContent: updatedHTML,
            imagePlaceholders: updatedPlaceholders,
            status: allDone ? 'done' : 'generating-images',
            finalHTML: updatedFinalHTML
          };
        });
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          console.log(`Image generation for ${placeholder.id} aborted`);
          return;
        }

        console.error(`Error generating images for ${placeholder.id}:`, error);
        setArticleResult(prev => {
          if (!prev) return null;
          return {
            ...prev,
            imagePlaceholders: prev.imagePlaceholders.map(p =>
              p.id === placeholder.id
                ? { ...p, status: 'error' as const, error: error instanceof Error ? error.message : 'Unknown error' }
                : p
            )
          };
        });
      } finally {
        imageControllersRef.current.delete(placeholder.id);
      }
    });

    await Promise.all(generationPromises);
    setIsGeneratingImages(false);
  }, [insertContentIntoTemplate]);

  /**
   * Генерирует текст статьи
   */
  const generateArticleText = useCallback(async (
    prompt: string,
    topic?: string,
    searchQuery?: string,
    htmlTemplate?: string,
    imageResolution?: ImageResolution,
    modelVersion: GeminiModelVersion = 'gemini-2.5-pro',
  ) => {
    const resolution = imageResolution || { width: 1408, height: 768, label: 'Дзен', aspectRatio: '16:9' };

    setIsGeneratingText(true);
    setArticleResult({
      id: `article-${Date.now()}`,
      prompt: prompt,
      htmlContent: '',
      imagePlaceholders: [],
      status: 'generating-text',
      createdAt: Date.now(),
      htmlTemplate: htmlTemplate || '',
      imageResolution: resolution
    });

    const controller = new AbortController();
    textControllerRef.current = controller;

    try {
      const response = await fetch('/api/ai/seo-article', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt, topic, searchQuery, modelVersion }),
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No reader available');
      }

      const decoder = new TextDecoder();
      let buffer = '';
      let htmlContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim()) {
            try {
              const data = JSON.parse(line);
              if (data.delta) {
                htmlContent += data.delta;
                setArticleResult(prev => prev ? {
                  ...prev,
                  htmlContent: htmlContent
                } : null);
              } else if (data.done) {
                // Текст сгенерирован, извлекаем промпты для изображений
                const placeholders = extractImagePrompts(htmlContent);

                // Формируем finalHTML с вставленным контентом в шаблон
                const finalHTML = htmlTemplate && htmlTemplate.trim()
                  ? insertContentIntoTemplate(htmlContent, htmlTemplate)
                  : htmlContent;

                console.log('📝 Article text generation done:', {
                  htmlContentLength: htmlContent.length,
                  htmlTemplateLength: htmlTemplate?.length || 0,
                  finalHTMLLength: finalHTML.length,
                  placeholdersCount: placeholders.length
                });

                setArticleResult(prev => prev ? {
                  ...prev,
                  htmlContent: htmlContent,
                  imagePlaceholders: placeholders,
                  status: placeholders.length > 0 ? 'generating-images' : 'done',
                  finalHTML: finalHTML
                } : null);

                setIsGeneratingText(false);

                // Автоматически запускаем генерацию изображений
                if (placeholders.length > 0) {
                  // Используем разрешение из замыкания
                  generateAllImages(htmlContent, placeholders, resolution);
                }
              } else if (data.error) {
                throw new Error(data.error);
              }
            } catch (parseError) {
              console.error('Error parsing stream data:', parseError);
            }
          }
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('Article text generation aborted');
        return;
      }
      console.error('Error generating article text:', error);
      setArticleResult(prev => prev ? {
        ...prev,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      } : null);
      setIsGeneratingText(false);
    } finally {
      textControllerRef.current = null;
    }
  }, [generateAllImages, insertContentIntoTemplate]);

  /**
   * Перегенерирует конкретное изображение
   */
  const regenerateImage = useCallback(async (placeholderId: string) => {
    const article = articleResult;
    if (!article) return;

    const placeholder = article.imagePlaceholders.find(p => p.id === placeholderId);
    if (!placeholder) return;

    // Отменяем предыдущую генерацию, если она идет
    const existingController = imageControllersRef.current.get(placeholderId);
    if (existingController) {
      existingController.abort();
    }

    const controller = new AbortController();
    imageControllersRef.current.set(placeholderId, controller);

    // Обновляем статус
    setArticleResult(prev => {
      if (!prev) return null;
      return {
        ...prev,
        imagePlaceholders: prev.imagePlaceholders.map(p =>
          p.id === placeholderId ? { ...p, status: 'generating', images: [] } : p
        )
      };
    });

    try {
      const response = await fetch('/api/ai/imagen', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
          body: JSON.stringify({
            prompt: placeholder.prompt,
            numberOfImages: placeholder.imageCount,
            imageSize: '1K',
            aspectRatio: article?.imageResolution?.aspectRatio || '16:9',
            modelVersion: 'imagen-4.0-generate-001'
          }),
          signal: controller.signal
        });

      if (!response.ok) {
        throw new Error(`Failed to regenerate image: ${response.status}`);
      }

      const data = await response.json();
      let images: GeneratedImage[] = data.images || [];

      // Оптимизируем изображения сразу после получения
      if (images.length > 0) {
        console.log('🔄 Optimizing regenerated images...');
        images = await Promise.all(
          images.map(async (img) => {
            try {
              const optimized = await optimizeImage(img.imageBytes, img.mimeType, 0.65);              return {
                ...img,
                imageBytes: optimized.imageBytes,
                mimeType: optimized.mimeType
              };
            } catch (error) {
              console.error('Error optimizing image, using original:', error);
              return img;
            }
          })
        );
        console.log('✅ Regenerated images optimized');
      }

      // Обновляем HTML с новыми изображениями
      setArticleResult(prev => {
        if (!prev) return null;

        const updatedPlaceholders = prev.imagePlaceholders.map(p =>
          p.id === placeholderId
            ? { ...p, images, status: 'done' as const }
            : p
        );

        // Проверяем, все ли изображения сгенерированы (или имеют ошибку)
        const allDone = updatedPlaceholders.every(p =>
          p.status === 'done' || p.status === 'error'
        );

        let updatedHTML = prev.htmlContent;
        if (images.length > 0) {
          updatedHTML = updateImagePlaceholderInHTML(
            updatedHTML,
            placeholderId,
            { ...placeholder, images, status: 'done' }
          );
        }

        // Обновляем finalHTML если есть шаблон
        const updatedFinalHTML = prev.htmlTemplate && prev.htmlTemplate.trim()
          ? insertContentIntoTemplate(updatedHTML, prev.htmlTemplate)
          : updatedHTML;

        return {
          ...prev,
          htmlContent: updatedHTML,
          imagePlaceholders: updatedPlaceholders,
          status: allDone ? 'done' : prev.status, // Обновляем статус если все готово
          finalHTML: updatedFinalHTML
        };
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log(`Image regeneration for ${placeholderId} aborted`);
        return;
      }

      console.error(`Error regenerating image for ${placeholderId}:`, error);
      setArticleResult(prev => {
        if (!prev) return null;

        const updatedPlaceholders = prev.imagePlaceholders.map(p =>
          p.id === placeholderId
            ? { ...p, status: 'error' as const, error: error instanceof Error ? error.message : 'Unknown error' }
            : p
        );

        // Проверяем, все ли изображения сгенерированы (или имеют ошибку)
        const allDone = updatedPlaceholders.every(p =>
          p.status === 'done' || p.status === 'error'
        );

        return {
          ...prev,
          imagePlaceholders: updatedPlaceholders,
          status: allDone ? 'done' : prev.status // Обновляем статус если все готово
        };
      });
    } finally {
      imageControllersRef.current.delete(placeholderId);
    }
  }, [articleResult, insertContentIntoTemplate]);

  /**
   * Отменяет генерацию текста
   */
  const abortTextGeneration = useCallback(() => {
    if (textControllerRef.current) {
      textControllerRef.current.abort();
      textControllerRef.current = null;
    }
  }, []);

  /**
   * Отменяет генерацию изображения
   */
  const abortImageGeneration = useCallback((placeholderId: string) => {
    const controller = imageControllersRef.current.get(placeholderId);
    if (controller) {
      controller.abort();
      imageControllersRef.current.delete(placeholderId);
    }
  }, []);

  /**
   * Сброс состояния
   */
  const reset = useCallback(() => {
    abortTextGeneration();
    imageControllersRef.current.forEach(controller => controller.abort());
    imageControllersRef.current.clear();
    setArticleResult(null);
    setIsGeneratingText(false);
    setIsGeneratingImages(false);
  }, [abortTextGeneration]);

  return {
    articleResult,
    isGeneratingText,
    isGeneratingImages,
    generateArticleText,
    regenerateImage,
    abortTextGeneration,
    abortImageGeneration,
    reset
  };
}