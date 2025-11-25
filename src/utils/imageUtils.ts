export const downloadImage = async (imageBytes: string, mimeType: string, filename: string) => {
  try {
    const byteCharacters = atob(imageBytes);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: mimeType });

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    console.log('📥 Image downloaded:', filename);
  } catch (error) {
    console.error('❌ Error downloading image:', error);
  }
};

export const copyPromptToClipboard = async (promptText: string) => {
  try {
    await navigator.clipboard.writeText(promptText);
    console.log('Промпт скопирован в буфер обмена');
  } catch (error) {
    console.error('Ошибка при копировании промпта:', error);
  }
};

/**
 * Оптимизирует изображение: изменяет размер (ограничивает высоту до maxHeight и ширину до maxWidth) и сжимает качество
 * @param imageBytes - base64 строка изображения (без префикса data:image/...;base64,)
 * @param mimeType - MIME тип изображения (например, 'image/jpeg', 'image/png')
 * @param quality - качество сжатия от 0 до 1 (по умолчанию 0.65)
 * @returns Promise с оптимизированным base64 изображением
 */
export const optimizeImage = async (
  imageBytes: string,
  mimeType: string,
  quality: number = 0.65
): Promise<{ imageBytes: string; mimeType: string }> => {
  return new Promise((resolve, reject) => {
    try {
      // Создаем изображение из base64
      const img = new Image();

      img.onload = () => {
        try {
          // Сохраняем оригинальные размеры - не изменяем их
          const originalWidth = img.width;
          const originalHeight = img.height;

          // Создаем canvas с оригинальными размерами
          const canvas = document.createElement('canvas');
          canvas.width = originalWidth;
          canvas.height = originalHeight;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Failed to get canvas context'));
            return;
          }

          // Рисуем изображение на canvas с оригинальными размерами
          ctx.drawImage(img, 0, 0, originalWidth, originalHeight);

          // Конвертируем в нужный формат (JPEG для лучшего сжатия, если исходное не PNG с прозрачностью)
          const outputMimeType = mimeType === 'image/png' ? 'image/png' : 'image/jpeg';

          // Получаем оптимизированное изображение (только сжатие качества, размеры не меняются)
          const optimizedDataUrl = canvas.toDataURL(outputMimeType, quality);

          // Извлекаем base64 без префикса
          const base64Data = optimizedDataUrl.split(',')[1];

          console.log('🖼️ Image optimized:', {
            originalSize: imageBytes.length,
            optimizedSize: base64Data.length,
            reduction: `${Math.round((1 - base64Data.length / imageBytes.length) * 100)}%`,
            originalDimensions: `${originalWidth}x${originalHeight}`,
            newDimensions: `${originalWidth}x${originalHeight}`,
            mimeType: outputMimeType,
            quality: quality
          });

          resolve({
            imageBytes: base64Data,
            mimeType: outputMimeType
          });
        } catch (error) {
          console.error('❌ Error optimizing image:', error);
          reject(error);
        }
      };

      img.onerror = (error) => {
        console.error('❌ Error loading image for optimization:', error);
        reject(new Error('Failed to load image'));
      };

      // Загружаем изображение
      const dataUrl = `data:${mimeType};base64,${imageBytes}`;
      img.src = dataUrl;
    } catch (error) {
      console.error('❌ Error in optimizeImage:', error);
      reject(error);
    }
  });
};