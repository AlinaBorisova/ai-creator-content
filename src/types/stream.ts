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

export type Mode = 'text' | 'html' | 'images' | 'videos';

export const PANELS_COUNT = 1;