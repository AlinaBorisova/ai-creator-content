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

export type Mode = 'text' | 'html' | 'images';

export const PANELS_COUNT = 1;