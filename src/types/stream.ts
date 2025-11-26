export type StreamStatus = 'idle' | 'loading' | 'done' | 'error';

export interface ImageGenerationResult {
  prompt: string;
  images: GeneratedImage[];
  status: 'idle' | 'loading' | 'done' | 'error';
  error?: string;
  translatedPrompt?: string;
  hasSlavicPrompts?: boolean;
  wasTranslated?: boolean;
}

export interface GeneratedImage {
  imageBytes: string;
  mimeType: string;
  index?: number;
}

export interface ReferenceImage {
  file: File;
  preview: string;
  name: string;
  size: number;
}

export interface VideoGenerationResult {
  prompt: string;
  video: GeneratedVideo;
  status: 'idle' | 'loading' | 'done' | 'error';
  error?: string;
  translatedPrompt?: string;
  hasSlavicPrompts?: boolean;
  wasTranslated?: boolean;
  referenceImages?: ReferenceImage[];
  model?: VideoModel;
}

export interface SEOArticleResult {
  id: string;
  prompt: string;
  htmlContent: string; // Готовая HTML статья с изображениями
  imagePlaceholders: ImagePlaceholder[]; // Места для изображений
  status: 'idle' | 'generating-text' | 'generating-images' | 'done' | 'error';
  error?: string;
  createdAt: number;
  htmlTemplate?: string; // HTML шаблон страницы
  finalHTML?: string; // Финальный HTML с вставленным контентом в шаблон
  imageResolution?: { width: number; height: number; label: string; aspectRatio: string }; // Разрешение изображений
}

export interface ImagePlaceholder {
  id: string; // Уникальный ID для идентификации
  prompt: string; // Промпт для генерации изображения
  position: number; // Позиция в тексте (индекс символа)
  images: GeneratedImage[]; // Сгенерированные изображения
  status: 'pending' | 'generating' | 'done' | 'error';
  error?: string;
  imageCount: number; // Количество изображений (1 или 2)
  className?: string; // Класс контейнера (stati__img, seo__content-images и т.д.)
  translatedPrompt?: string; // Переведенный промпт
  hasSlavicPrompts?: boolean; // Применены ли славянские подсказки
  wasTranslated?: boolean; // Был ли промпт переведен
  allPositions?: number[]; // Все позиции, где используется этот промпт (для группировки одинаковых промптов)
}

export interface GeneratedVideo {
  videoBytes: string;
  mimeType: string;
  duration: number;
  resolution: string;
  aspectRatio: string;
  index?: number;
}

export type VideoModel = 'Veo 2' | 'Veo 3' | 'Veo 3 Fast' | 'Veo 3.1' | 'Veo 3.1 Fast';

export type VideoDuration = '4' | '5' | '6' | '8';

export type VideoGenerationMode = 'text-to-video' | 'image-to-video';

export interface GroundingSource {
  title: string;
  uri: string;
}

// Тип для grounding chunk из API ответа
export interface GroundingChunk {
  web?: {
    title: string;
    uri: string;
  };
}

export interface GroundingMetadata {
  webSearchQueries: string[];
  groundingChunks: GroundingChunk[];
  groundingSupports: {
    segment: {
      startIndex: number;
      endIndex: number;
      text: string;
    };
    groundingChunkIndices: number[];
  }[];
}

export type StreamState = {
  text: string;
  status: StreamStatus;
  error?: string | null;
  // Новые поля для grounding
  groundingMetadata?: GroundingMetadata;
  sources?: GroundingSource[];
  searchQueries?: string[];
};

export type HistoryItem = {
  id: string;
  prompt: string;
  timestamp: number;
  results?: StreamState[];
  imageResults?: ImageGenerationResult[];
  videoResults?: VideoGenerationResult[];
  model?: string;
  referenceImages?: ReferenceImage[];
};

export interface ServerHistoryItem {
  id: string;
  userId: string;
  prompt: string;
  mode: string;
  model?: string;
  results?: unknown;
  createdAt: string;
}

export interface ApiUser {
  id: string;
  name: string;
  email?: string;
  createdAt: string;
  isActive: boolean;
}

export interface ApiToken {
  id: string;
  token: string;
  userId: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  expiresAt?: string;
}

export type Mode = 'text' | 'html' | 'images' | 'videos' | 'research' | 'seo-article';

export const PANELS_COUNT = 1;