import { TextIcon, ImageIcon, VideoIcon, GlobeIcon, SearchIcon } from './Icons';

interface ModeSelectorProps {
  mode: 'text' | 'html' | 'images' | 'videos' | 'research';
  onModeChange: (mode: 'text' | 'html' | 'images' | 'videos' | 'research') => void;
  selectedImageModel: string | null;
  onImageModelChange: (model: string | null) => void;
  isImagesDropdownOpen: boolean;
  onImagesDropdownToggle: () => void;
  imageModels: string[];
}

export function ModeSelector({
  mode,
  onModeChange,
  selectedImageModel,
  onImageModelChange,
  isImagesDropdownOpen,
  onImagesDropdownToggle,
  imageModels
}: ModeSelectorProps) {
  return (
    <div className="flex gap-2 mb-4">
      <button
        onClick={() => onModeChange('html')}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium cursor-pointer border border-gray-700 transition-all duration-300 hover:scale-105 ${mode === 'html'
          ? 'bg-(--btn-active-color) text-white'
          : 'bg-(--btn-color) text-gray-300 hover:border-(--btn-hover-border)'
          }`}
      >
        <GlobeIcon className="w-4 h-4" /> HTML
      </button>
      <button
        onClick={() => onModeChange('text')}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium cursor-pointer border border-gray-700 transition-all duration-300 hover:scale-105 ${mode === 'text'
          ? 'bg-(--btn-active-color) text-white'
          : 'bg-(--btn-color) text-gray-300 hover:border-(--btn-hover-border)'
          }`}
      >
        <TextIcon className="w-4 h-4" /> Текст
      </button>
      <button
        onClick={() => onModeChange('research')}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium cursor-pointer border border-gray-700 transition-all duration-300 hover:scale-105 ${mode === 'research'
          ? 'bg-(--btn-active-color) text-white'
          : 'bg-(--btn-color) text-gray-300 hover:border-(--btn-hover-border)'
          }`}
      >
        <SearchIcon className="w-4 h-4" /> Research
      </button>
      <div className="relative">
        <button
          onClick={onImagesDropdownToggle}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium border border-gray-700 cursor-pointer transition-all duration-300 hover:scale-105 ${mode === 'images'
            ? 'bg-(--btn-active-color) text-white'
            : 'bg-(--btn-color) text-gray-300 hover:border-(--btn-hover-border)'
            }`}
        >
          <ImageIcon className="w-4 h-4" /> {selectedImageModel || 'Изображения'}
        </button>
        {isImagesDropdownOpen && (
          <div className="absolute top-full left-0 mt-1 bg-(--btn-color) rounded-lg shadow-lg z-50 min-w-[120px]">
            {imageModels.map((model) => (
              <button
                key={model}
                onClick={() => {
                  onImageModelChange(model);
                  onModeChange('images');
                  onImagesDropdownToggle();
                }}
                className={`w-full text-left px-4 py-2 text-sm text-gray-300 cursor-pointer border border-gray-700 hover:border-(--btn-hover-border) first:rounded-t-lg last:rounded-b-lg transition-colors ${selectedImageModel === model ? 'bg-(--btn-color)' : ''
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
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium border border-gray-700 cursor-pointer transition-all duration-300 hover:scale-105 ${mode === 'videos'
            ? 'bg-(--btn-active-color) text-white'
            : 'bg-(--btn-color) text-gray-300 hover:border-(--btn-hover-border)'
            }`}
        >
          <VideoIcon className="w-4 h-4" /> Видео
        </button>


      </div>
    </div>
  );
}