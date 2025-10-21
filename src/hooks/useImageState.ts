import { useState, useEffect } from 'react';

export function useImageState() {
  const [imageCount, setImageCount] = useState(1);
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [imagenModel, setImagenModel] = useState('imagen-4.0-generate-001');
  const [imageSize, setImageSize] = useState('1K');

  // useEffect для автоматического сброса размера при смене модели
  useEffect(() => {
    if (imagenModel === 'imagen-4.0-fast-generate-001') {
      setImageSize('1K'); // Автоматически сбрасываем на 1K для Fast модели
    }
  }, [imagenModel]);

  return {
    imageCount,
    setImageCount,
    aspectRatio,
    setAspectRatio,
    imagenModel,
    setImagenModel,
    imageSize,
    setImageSize
  };
}