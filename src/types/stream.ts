export type StreamStatus = 'idle' | 'loading' | 'done' | 'error';

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
};

export const PANELS_COUNT = 5;