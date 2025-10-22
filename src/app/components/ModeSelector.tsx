import { TextIcon, ImageIcon, VideoIcon, GlobeIcon } from './Icons';
//import { VideoModel } from '@/types/stream';

interface ModeSelectorProps {
  mode: 'text' | 'html' | 'images' | 'videos';
  onModeChange: (mode: 'text' | 'html' | 'images' | 'videos') => void;
  selectedImageModel: string | null;
  onImageModelChange: (model: string | null) => void;
  isImagesDropdownOpen: boolean;
  onImagesDropdownToggle: () => void;
  imageModels: string[];
  // selectedVideoModel: VideoModel | null;
  // onVideoModelChange: (model: VideoModel | null) => void;
  // isVideosDropdownOpen: boolean;
  // onVideosDropdownToggle: () => void;
  // videoModels: VideoModel[];
}

export function ModeSelector({
  mode,
  onModeChange,
  selectedImageModel,
  onImageModelChange,
  isImagesDropdownOpen,
  onImagesDropdownToggle,
  imageModels,
  // selectedVideoModel,
  // onVideoModelChange,
  // isVideosDropdownOpen,
  // onVideosDropdownToggle,
  // videoModels
}: ModeSelectorProps) {
  return (
    <div className="flex gap-2 mb-4">
      <button
        onClick={() => onModeChange('html')}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium cursor-pointer transition-colors ${mode === 'html'
          ? 'bg-blue-600 text-white'
          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
      >
        <GlobeIcon className="w-4 h-4" /> HTML
      </button>
      <button
        onClick={() => onModeChange('text')}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium cursor-pointer transition-colors ${mode === 'text'
          ? 'bg-blue-600 text-white'
          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
      >
        <TextIcon className="w-4 h-4" /> Текст
      </button>
      <div className="relative">
        <button
          onClick={onImagesDropdownToggle}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium cursor-pointer transition-colors ${mode === 'images'
            ? 'bg-blue-600 text-white'
            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
        >
          <ImageIcon className="w-4 h-4" /> {selectedImageModel || 'Изображения'}
        </button>
        {isImagesDropdownOpen && (
          <div className="absolute top-full left-0 mt-1 bg-gray-700 rounded-lg shadow-lg z-50 min-w-[120px]">
            {imageModels.map((model) => (
              <button
                key={model}
                onClick={() => {
                  onImageModelChange(model);
                  onModeChange('images');
                  onImagesDropdownToggle();
                }}
                className={`w-full text-left px-4 py-2 text-sm text-gray-300 cursor-pointer hover:bg-gray-600 first:rounded-t-lg last:rounded-b-lg transition-colors ${selectedImageModel === model ? 'bg-gray-600' : ''
                  }`}
              >
                {model}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="relative">
        <button
          onClick={() => onModeChange('videos')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium cursor-pointer transition-colors ${mode === 'videos'
            ? 'bg-blue-600 text-white'
            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
        >
          <VideoIcon className="w-4 h-4" /> Видео
        </button>


      </div>
    </div>
  );
}