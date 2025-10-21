import { VideoGenerationMode } from '@/hooks/useVideoState';
import { TextIcon, ImageIcon } from './Icons';

interface VideoModeSelectorProps {
  mode: VideoGenerationMode;
  onModeChange: (mode: VideoGenerationMode) => void;
}

export function VideoModeSelector({ mode, onModeChange }: VideoModeSelectorProps) {
  return (
    <div className="mb-4">
      <span className="text-sm text-gray-400 mb-2 block">Режим генерации:</span>
      <div className="flex gap-2">
        <button
          onClick={() => onModeChange('text-to-video')}
          className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 cursor-pointer transition-colors ${mode === 'text-to-video'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
        >
          <TextIcon className="w-4 h-4" /> Текст в видео
        </button>
        <button
          onClick={() => onModeChange('image-to-video')}
          className={`px-4 py-2 rounded-lg text-sm flex items-center gap-2 font-medium cursor-pointer transition-colors ${mode === 'image-to-video'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
        >
          <ImageIcon className="w-4 h-4" /> Изображение в видео
        </button>
      </div>
    </div>
  );
}