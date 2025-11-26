import { ImagePlaceholder } from '@/types/stream';

/**
 * Извлекает промпты для изображений из HTML контента
 */
export function extractImagePrompts(htmlContent: string): ImagePlaceholder[] {
  const placeholders: ImagePlaceholder[] = [];

  // Регулярное выражение для поиска div с data-image-prompt (поддерживает любые классы)
  // Ищем div с любым классом, содержащим data-image-prompt и data-image-count
  const regex = /<div\s+class="([^"]+)"\s+data-image-prompt="([^"]+)"\s+data-image-count="(\d+)"[^>]*>/g;

  let match;
  let placeholderIndex = 0;

  while ((match = regex.exec(htmlContent)) !== null) {
    const className = match[1]; // Извлекаем класс
    const prompt = match[2];
    const imageCount = parseInt(match[3], 10) || 1;
    const matchPosition = match.index;

    placeholders.push({
      id: `image-${placeholderIndex++}`,
      prompt: prompt,
      position: matchPosition,
      images: [],
      status: 'pending',
      imageCount: imageCount,
      className: className // Сохраняем оригинальный класс
    });
  }

  return placeholders;
}

/**
 * Заменяет placeholder изображения на реальные изображения в HTML
 */
export function insertImagesIntoHTML(
  htmlContent: string,
  placeholders: ImagePlaceholder[],
  imageResolution?: { width: number; height: number; label: string; aspectRatio: string }
): string {
  let result = htmlContent;

  // Сортируем по позиции в обратном порядке, чтобы не сбить индексы при замене
  const sortedPlaceholders = [...placeholders].sort((a, b) => b.position - a.position);


  // Формируем стиль на основе параметров разрешения из UI
  let imageStyle = 'width: auto; height: auto;';
  if (imageResolution) {
    imageStyle = `width: ${imageResolution.width}px; height: ${imageResolution.height}px; max-width: 100%; object-fit: contain;`;
  }

  for (const placeholder of sortedPlaceholders) {
    const className = placeholder.className || 'stati__img';
    const escapedClassName = className.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const escapedPrompt = placeholder.prompt.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Ищем div с нужным классом и промптом
    const regex = new RegExp(
      `<div\\s+class="${escapedClassName}"[^>]*data-image-prompt="${escapedPrompt}"[^>]*data-image-count="\\d+"[^>]*>\\s*<!--[^>]*-->\\s*</div>`,
      'g'
    );

    // Находим соответствующий div начиная с позиции placeholder
    const searchStart = result.substring(placeholder.position);
    const match = searchStart.match(regex);

    if (match) {
      const fullMatch = match[0];
      const imageTags = placeholder.images
        .map((img, idx) => {
          const imageData = `data:${img.mimeType};base64,${img.imageBytes}`;
          return `<img src="${imageData}" alt="Image ${idx + 1}" style="${imageStyle}" loading="lazy" decoding="async" fetchpriority="low" />`;
        })
        .join('\n     ');

      const replacement = `<div class="${className}">\n     ${imageTags}\n</div>`;
      const beforePosition = result.substring(0, placeholder.position);
      const afterPosition = result.substring(placeholder.position);
      result = beforePosition + afterPosition.replace(fullMatch, replacement);
    }
  }

  return result;
}

/**
 * Обновляет конкретный placeholder в HTML
 */
export function updateImagePlaceholderInHTML(
  htmlContent: string,
  placeholderId: string,
  placeholder: ImagePlaceholder,
  imageResolution?: { width: number; height: number; label: string; aspectRatio: string }
): string {
  // Находим div с нужным placeholder (поддерживает любые классы)
  // Экранируем специальные символы в промпте для использования в regex
  const escapedPrompt = placeholder.prompt.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const escapedClassName = (placeholder.className || 'stati__img').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // Ищем div с нужным классом и промптом
  const regex = new RegExp(
    `<div\\s+class="${escapedClassName}"[^>]*data-image-prompt="${escapedPrompt}"[^>]*data-image-count="\\d+"[^>]*>([\\s\\S]*?)</div>`,
    'g'
  );

  let result = htmlContent;
  let match;

  while ((match = regex.exec(htmlContent)) !== null) {
    const fullMatch = match[0];

    // Используем сохраненный класс или дефолтный
    const className = placeholder.className || 'stati__img';

    // Формируем стиль на основе параметров разрешения из UI
    let imageStyle = 'width: auto; height: auto;';
    if (imageResolution) {
      imageStyle = `width: ${imageResolution.width}px; height: ${imageResolution.height}px; max-width: 100%; object-fit: contain;`;
    }

    const imageTags = placeholder.images
      .map((img, idx) => {
        const imageData = `data:${img.mimeType};base64,${img.imageBytes}`;
        return `<img src="${imageData}" alt="Image ${idx + 1}" style="${imageStyle}" loading="lazy" decoding="async" fetchpriority="low" />`;
      })
      .join('\n     ');

    const replacement = `<div class="${className}">\n     ${imageTags}\n</div>`;
    result = result.replace(fullMatch, replacement);
    break;
  }

  return result;
}