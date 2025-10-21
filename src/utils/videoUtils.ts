import { GeneratedVideo } from '@/types/stream';

export const downloadVideo = (video: GeneratedVideo, filename: string) => {
  const link = document.createElement('a');
  link.href = `data:${video.mimeType};base64,${video.videoBytes}`;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const copyPromptToClipboard = async (promptText: string) => {
  try {
    await navigator.clipboard.writeText(promptText);
  } catch (error) {
    console.error('Failed to copy prompt:', error);
  }
};