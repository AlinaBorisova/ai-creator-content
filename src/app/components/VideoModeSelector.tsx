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
          className={`px-4 py-2 rounded-lg text-sm border border-gray-700 font-medium flex items-center gap-2 cursor-pointer transition-all duration-300 hover:scale-105 ${mode === 'text-to-video'
            ? 'bg-(--btn-active-color) text-white'
            : 'bg-(--btn-color) text-gray-300 hover:border-(--btn-hover-border)'
            }`}
        >
          <TextIcon className="w-4 h-4" /> Текст в видео
        </button>
        <button
          onClick={() => onModeChange('image-to-video')}
          className={`px-4 py-2 rounded-lg text-sm flex items-center border border-gray-700 gap-2 font-medium cursor-pointer transition-all duration-300 hover:scale-105 ${mode === 'image-to-video'
            ? 'bg-(--btn-active-color) text-white'
            : 'bg-(--btn-color) text-gray-300 hover:border-(--btn-hover-border)'
            }`}
        >
          <ImageIcon className="w-4 h-4" /> Изображение в видео
        </button>
      </div>
    </div>
  );
}