import { ImagePlaceholder } from '@/types/stream';

/**
 * Разделяет промпт на отдельные, если он содержит "Photo 1:", "Photo 2:" и т.д.
 * Возвращает массив промптов (каждый "Photo N:" становится отдельным промптом)
 * Разделяет промпты вида "Photo 1: ... Photo 2: ..." на отдельные
 */
function splitMultiPhotoPrompt(prompt: string): string[] {
  // Ищем паттерн "Photo N:" где N - число
  const photoPattern = /Photo\s+\d+:\s*/gi;
  const matches = [...prompt.matchAll(photoPattern)];

  if (matches.length === 0) {
    // Нет паттерна "Photo N:", возвращаем как есть
    return [prompt];
  }

  if (matches.length === 1) {
    // Только одно "Photo N:", убираем префикс и возвращаем
    return [prompt.replace(photoPattern, '').trim()];
  }

  // Несколько "Photo N:", разделяем на отдельные промпты
  const parts: string[] = [];

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const startIndex = match.index! + match[0].length; // Начинаем после "Photo N: "

    // Определяем конец текущей части (начало следующего "Photo N:" или конец строки)
    const endIndex = i < matches.length - 1
      ? matches[i + 1].index!
      : prompt.length;

    // Извлекаем текст между "Photo N:" и следующим "Photo N:" (или концом)
    const part = prompt.substring(startIndex, endIndex).trim();
    if (part) {
      parts.push(part);
    }
  }

  return parts.filter(p => p.length > 0);
}

/**
 * Извлекает промпты для изображений из HTML контента
 * Группирует одинаковые промпты, чтобы не генерировать их несколько раз
 */
export function extractImagePrompts(htmlContent: string): ImagePlaceholder[] {
  const placeholders: ImagePlaceholder[] = [];
  const promptMap = new Map<string, { positions: number[], className: string, imageCount: number }>();

  // Регулярное выражение для поиска div с data-image-prompt (поддерживает любые классы)
  // Ищем div с любым классом, содержащим data-image-prompt и data-image-count
  const regex = /<div\s+class="([^"]+)"\s+data-image-prompt="([^"]+)"\s+data-image-count="(\d+)"[^>]*>/g;

  let match;
  let placeholderIndex = 0;

  // Временное логирование: собираем информацию о промптах от Gemini
  const geminiPrompts: Array<{
    original: string;
    className: string;
    dataImageCount: string;
    splitPrompts: string[];
  }> = [];

  while ((match = regex.exec(htmlContent)) !== null) {
    const className = match[1]; // Извлекаем класс
    const originalPrompt = match[2];
    const dataImageCount = match[3];
    //const imageCount = parseInt(match[3], 10) || 1;
    const matchPosition = match.index;

    // Разделяем промпт, если он содержит несколько "Photo N:"
    const splitPrompts = splitMultiPhotoPrompt(originalPrompt);

    // Временное логирование: сохраняем информацию о промпте от Gemini
    geminiPrompts.push({
      original: originalPrompt,
      className: className,
      dataImageCount: dataImageCount,
      splitPrompts: splitPrompts
    });

    // Для каждого разделенного промпта создаем отдельный placeholder
    for (const prompt of splitPrompts) {
      // Группируем по промпту: если промпт уже встречался, добавляем позицию
      if (promptMap.has(prompt)) {
        const existing = promptMap.get(prompt)!;
        existing.positions.push(matchPosition);
      } else {
        promptMap.set(prompt, {
          positions: [matchPosition],
          className: className,
          imageCount: 1 // Всегда генерируем только одно изображение на промпт
        });
      }
    }
  }

  // Временное логирование: выводим информацию о промптах от Gemini
  console.log('📸 ===== ПРОМПТЫ ДЛЯ ИЗОБРАЖЕНИЙ ОТ GEMINI =====');
  console.log(`Найдено div'ов с промптами: ${geminiPrompts.length}`);
  geminiPrompts.forEach((item, index) => {
    console.log(`\n--- Div #${index + 1} ---`);
    console.log(`Класс: ${item.className}`);
    console.log(`data-image-count: ${item.dataImageCount}`);
    console.log(`Оригинальный промпт от Gemini:`);
    console.log(`  "${item.original}"`);
    console.log(`Разделено на промптов: ${item.splitPrompts.length}`);
    item.splitPrompts.forEach((splitPrompt, splitIndex) => {
      console.log(`  Промпт ${splitIndex + 1}: "${splitPrompt}"`);
    });
  });
  console.log('\n📸 ===== ФИНАЛЬНЫЕ ПРОМПТЫ ДЛЯ ГЕНЕРАЦИИ =====');
  console.log(`Уникальных промптов для генерации: ${promptMap.size}`);
  let finalIndex = 1;
  for (const [prompt, data] of promptMap.entries()) {
    console.log(`\nПромпт #${finalIndex++}: "${prompt}"`);
    console.log(`  Класс: ${data.className}`);
    console.log(`  Позиций в HTML: ${data.positions.length}`);
    console.log(`  Будет сгенерировано изображений: ${data.imageCount}`);
  }
  console.log('📸 ============================================\n');

  // Создаем placeholder для каждого уникального промпта
  for (const [prompt, data] of promptMap.entries()) {
    // Используем первую позицию как основную для placeholder'а
    placeholders.push({
      id: `image-${placeholderIndex++}`,
      prompt: prompt,
      position: data.positions[0], // Первая позиция
      images: [],
      status: 'pending',
      imageCount: 1, // Всегда генерируем только одно изображение на промпт
      className: data.className,
      // Сохраняем все позиции, где используется этот промпт
      allPositions: data.positions
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
    imageStyle = `width: ${imageResolution.width}px; height: ${imageResolution.height}px; max-width: 100%;`;
  }

  for (const placeholder of sortedPlaceholders) {
    const className = placeholder.className || 'stati__img';
    const escapedClassName = className.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const escapedPrompt = placeholder.prompt.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const imageTags = placeholder.images
      .map((img, idx) => {
        const imageData = `data:${img.mimeType};base64,${img.imageBytes}`;
        return `<img src="${imageData}" alt="Image ${idx + 1}" style="${imageStyle}" loading="lazy" decoding="async" fetchpriority="low" />`;
      })
      .join('\n     ');

    const replacement = `<div class="${className}">\n     ${imageTags}\n</div>`;

    // Если есть все позиции, обновляем каждую позицию отдельно
    if (placeholder.allPositions && placeholder.allPositions.length > 0) {
      // Сортируем позиции в обратном порядке
      const sortedPositions = [...placeholder.allPositions].sort((a, b) => b - a);

      for (const pos of sortedPositions) {
        // Ищем div с нужным классом и промптом
        const regex = new RegExp(
          `<div\\s+class="${escapedClassName}"[^>]*data-image-prompt="${escapedPrompt}"[^>]*data-image-count="\\d+"[^>]*>\\s*<!--[^>]*-->\\s*</div>`,
          'g'
        );

        // Находим соответствующий div начиная с позиции placeholder
        const searchStart = result.substring(pos);
        const match = searchStart.match(regex);

        if (match) {
          const fullMatch = match[0];
          const beforePosition = result.substring(0, pos);
          const afterPosition = result.substring(pos);
          result = beforePosition + afterPosition.replace(fullMatch, replacement);
        }
      }
    } else {
      // Fallback: используем старую логику
      const regex = new RegExp(
        `<div\\s+class="${escapedClassName}"[^>]*data-image-prompt="${escapedPrompt}"[^>]*data-image-count="\\d+"[^>]*>\\s*<!--[^>]*-->\\s*</div>`,
        'g'
      );

      const searchStart = result.substring(placeholder.position);
      const match = searchStart.match(regex);

      if (match) {
        const fullMatch = match[0];
        const beforePosition = result.substring(0, placeholder.position);
        const afterPosition = result.substring(placeholder.position);
        result = beforePosition + afterPosition.replace(fullMatch, replacement);
      }
    }
  }

  return result;
}

/**
 * Обновляет конкретный placeholder в HTML
 * Обновляет все div'ы с одинаковым промптом, если они есть
 */
export function updateImagePlaceholderInHTML(
  htmlContent: string,
  placeholderId: string,
  placeholder: ImagePlaceholder,
  imageResolution?: { width: number; height: number; label: string; aspectRatio: string }
): string {
  const escapedClassName = (placeholder.className || 'stati__img').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const className = placeholder.className || 'stati__img';

  // Формируем стиль на основе параметров разрешения из UI
  let imageStyle = 'width: auto; height: auto;';
  if (imageResolution) {
    imageStyle = `width: ${imageResolution.width}px; height: ${imageResolution.height}px; max-width: 100%;`;
  }

  const imageTags = placeholder.images
    .map((img, idx) => {
      const imageData = `data:${img.mimeType};base64,${img.imageBytes}`;
      return `<img src="${imageData}" alt="Image ${idx + 1}" style="${imageStyle}" loading="lazy" decoding="async" fetchpriority="low" />`;
    })
    .join('\n     ');

  const replacement = `<div class="${className}">\n     ${imageTags}\n</div>`;

  let result = htmlContent;
  let match;
  let replacedCount = 0;

  // Если есть все позиции, обновляем каждую позицию отдельно
  if (placeholder.allPositions && placeholder.allPositions.length > 0) {
    // Сортируем позиции в обратном порядке, чтобы не сбить индексы при замене
    const sortedPositions = [...placeholder.allPositions].sort((a, b) => b - a);

    for (const pos of sortedPositions) {
      // Сначала пытаемся найти div с атрибутами data-image-prompt
      if (placeholder.prompt) {
        const escapedPrompt = placeholder.prompt.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const placeholderRegex = new RegExp(
          `<div\\s+class="${escapedClassName}"[^>]*data-image-prompt="${escapedPrompt}"[^>]*data-image-count="\\d+"[^>]*>([\\s\\S]*?)</div>`,
          'g'
        );

        const searchStart = result.substring(pos);
        match = placeholderRegex.exec(searchStart);
        if (match) {
          const beforePosition = result.substring(0, pos);
          const afterPosition = result.substring(pos);
          result = beforePosition + afterPosition.replace(match[0], replacement);
          replacedCount++;
          continue;
        }
      }

      // Если не нашли placeholder, ищем div по классу
      const searchStart = result.substring(pos);
      const classRegex = new RegExp(
        `<div\\s+class="${escapedClassName}"[^>]*>([\\s\\S]*?)</div>`,
        'g'
      );

      match = classRegex.exec(searchStart);
      if (match) {
        const actualMatch = match[0];
        const beforePosition = result.substring(0, pos);
        const afterPosition = result.substring(pos);
        result = beforePosition + afterPosition.replace(actualMatch, replacement);
        replacedCount++;
      }
    }

    if (replacedCount > 0) {
      return result;
    }
  }

  // Fallback: используем старую логику, если allPositions не задано
  // Сначала пытаемся найти div с атрибутами data-image-prompt (если это еще placeholder)
  if (placeholder.prompt) {
    const escapedPrompt = placeholder.prompt.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const placeholderRegex = new RegExp(
      `<div\\s+class="${escapedClassName}"[^>]*data-image-prompt="${escapedPrompt}"[^>]*data-image-count="\\d+"[^>]*>([\\s\\S]*?)</div>`,
      'g'
    );

    // Заменяем все вхождения с одинаковым промптом
    result = result.replace(placeholderRegex, replacement);
    if (result !== htmlContent) {
      return result;
    }
  }

  // Если не нашли placeholder, ищем div по классу, используя позицию для точности
  if (placeholder.position !== undefined) {
    // Ищем div с нужным классом, начиная с позиции placeholder'а
    const searchStart = htmlContent.substring(placeholder.position);
    const classRegex = new RegExp(
      `<div\\s+class="${escapedClassName}"[^>]*>([\\s\\S]*?)</div>`,
      'g'
    );

    match = classRegex.exec(searchStart);
    if (match) {
      // Заменяем в исходном HTML, учитывая смещение позиции
      const actualMatch = match[0];
      const beforePosition = htmlContent.substring(0, placeholder.position);
      const afterPosition = htmlContent.substring(placeholder.position);
      result = beforePosition + afterPosition.replace(actualMatch, replacement);
      return result;
    }
  }

  // Если позиция не помогла, ищем первый div с нужным классом, который содержит изображения
  // Это менее точный метод, но работает как fallback
  const classWithImagesRegex = new RegExp(
    `<div\\s+class="${escapedClassName}"[^>]*>([\\s\\S]*?<img[^>]*>[\\s\\S]*?)</div>`,
    'g'
  );

  match = classWithImagesRegex.exec(htmlContent);
  if (match) {
    result = result.replace(match[0], replacement);
    return result;
  }

  // Если ничего не нашли, возвращаем исходный HTML
  console.warn(`Could not find div to update for placeholder ${placeholderId}`);
  return result;
}