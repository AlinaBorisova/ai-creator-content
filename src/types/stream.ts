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

export type StreamState = {
  text: string;
  status: StreamStatus;
  error?: string | null;
};

export type HistoryItem = {
  id: string;
  prompt: string;
  timestamp: number;
  results?: StreamState[];
  imageResults?: ImageGenerationResult[];
  model?: string;
};

export type Mode = 'text' | 'html' | 'images';

export const PANELS_COUNT = 1;