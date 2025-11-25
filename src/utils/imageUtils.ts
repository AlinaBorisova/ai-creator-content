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
 * @param maxHeight - максимальная высота в пикселях (по умолчанию 550)
 * @param quality - качество сжатия от 0 до 1 (по умолчанию 0.65)
 * @param maxWidth - максимальная ширина в пикселях (по умолчанию 1100)
 * @returns Promise с оптимизированным base64 изображением
 */
export const optimizeImage = async (
  imageBytes: string,
  mimeType: string,
  maxHeight: number = 550,
  quality: number = 0.65,
  maxWidth: number = 1100
): Promise<{ imageBytes: string; mimeType: string }> => {
  return new Promise((resolve, reject) => {
    try {
      // Создаем изображение из base64
      const img = new Image();

      img.onload = () => {
        try {
          // Вычисляем новые размеры с сохранением пропорций
          let newWidth = img.width;
          let newHeight = img.height;

          // Сначала ограничиваем по высоте
          if (newHeight > maxHeight) {
            const ratio = maxHeight / newHeight;
            newHeight = maxHeight;
            newWidth = Math.round(newWidth * ratio);
          }

          // Затем ограничиваем по ширине, если нужно
          if (newWidth > maxWidth) {
            const ratio = maxWidth / newWidth;
            newWidth = maxWidth;
            newHeight = Math.round(newHeight * ratio);
          }

          // Если изображение уже меньше maxHeight и maxWidth, не изменяем размер
          // но все равно сжимаем качество для уменьшения размера файла

          // Создаем canvas
          const canvas = document.createElement('canvas');
          canvas.width = newWidth;
          canvas.height = newHeight;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Failed to get canvas context'));
            return;
          }

          // Рисуем изображение на canvas
          ctx.drawImage(img, 0, 0, newWidth, newHeight);

          // Конвертируем в нужный формат (JPEG для лучшего сжатия, если исходное не PNG с прозрачностью)
          const outputMimeType = mimeType === 'image/png' ? 'image/png' : 'image/jpeg';

          // Получаем оптимизированное изображение
          const optimizedDataUrl = canvas.toDataURL(outputMimeType, quality);

          // Извлекаем base64 без префикса
          const base64Data = optimizedDataUrl.split(',')[1];

          console.log('🖼️ Image optimized:', {
            originalSize: imageBytes.length,
            optimizedSize: base64Data.length,
            reduction: `${Math.round((1 - base64Data.length / imageBytes.length) * 100)}%`,
            originalDimensions: `${img.width}x${img.height}`,
            newDimensions: `${newWidth}x${newHeight}`,
            mimeType: outputMimeType
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