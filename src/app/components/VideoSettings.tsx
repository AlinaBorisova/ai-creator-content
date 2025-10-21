import { VideoModeSelector } from './VideoModeSelector';
import { StartingImageUpload } from './StartingImageUpload';
//import { ReferenceImageUpload } from './ReferenceImageUpload';
import { ReferenceImage, VideoGenerationMode } from '@/types/stream';
import { InfoIcon } from './Icons';

interface VideoSettingsProps {
  generationMode: VideoGenerationMode;
  resolution: string;
  aspectRatio: string;
  //referenceImages: ReferenceImage[];
  startingImage: ReferenceImage | null;
  onModeChange: (mode: VideoGenerationMode) => void;
  onResolutionChange: (resolution: string) => void;
  onAspectRatioChange: (aspectRatio: string) => void;
  onAddReferenceImage: (file: File) => void;
  onRemoveReferenceImage: (index: number) => void;
  onClearReferenceImages: () => void;
  onSetStartingImage: (file: File) => void;
  onClearStartingImage: () => void;
}

export function VideoSettings({
  generationMode,
  resolution,
  aspectRatio,
  //referenceImages,
  startingImage,
  onModeChange,
  onResolutionChange,
  onAspectRatioChange,
  //onAddReferenceImage,
  //onRemoveReferenceImage,
  //onClearReferenceImages,
  onSetStartingImage,
  onClearStartingImage
}: VideoSettingsProps) {
  //const hasReferenceImages = referenceImages.length > 0;
  //const hasStartingImage = startingImage !== null;

  return (
    <>
      {/* Выбор разрешения */}
      <div className="flex gap-2 mb-4">
        <span className="text-sm text-gray-400 self-center mr-2">Разрешение:</span>
        {[
          { value: '720p', label: '720p' },
          { value: '1080p', label: '1080p' }
        ].map((res) => (
          <button
            key={res.value}
            onClick={() => onResolutionChange(res.value)}
            className={`px-3 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors ${resolution === res.value
              ? 'bg-blue-600 text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            title={res.label}
          >
            {res.label}
          </button>
        ))}
      </div>

      {/* Выбор соотношения сторон */}
      <div className="flex gap-2 mb-4">
        <span className="text-sm text-gray-400 self-center mr-2">Соотношение:</span>
        {[
          { value: '16:9', label: '16:9' },
          { value: '9:16', label: '9:16' }
        ].map((ratio) => (
          <button
            key={ratio.value}
            onClick={() => onAspectRatioChange(ratio.value)}
            className={`px-3 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors ${aspectRatio === ratio.value
              ? 'bg-blue-600 text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            title={ratio.label}
          >
            {ratio.label}
          </button>
        ))}
      </div>

      {/* Выбор режима генерации */}
      <VideoModeSelector mode={generationMode} onModeChange={onModeChange} />

      {/* Информация о длительности */}
      <div className="mb-4 p-3 bg-blue-900/20 border border-blue-700/30 rounded-lg">
        <div className="flex items-start gap-2">
          <InfoIcon className="text-blue-400 text-sm w-4 h-4 mt-0.5" />
          <div className="text-sm text-blue-200">
            <p className="font-medium mb-1">Длительность видео:</p>
            <ul className="text-xs text-blue-300 space-y-1">
              <li>• 4-6 секунд: автоматически</li>
              <li>• 8 секунд: при использовании референсных изображений</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Условный контент в зависимости от режима */}
      {generationMode === 'image-to-video' && (
        <>
          {/* Стартовое изображение для режима изображение-в-видео */}
          <StartingImageUpload
            startingImage={startingImage}
            onSetImage={onSetStartingImage}
            onClearImage={onClearStartingImage}
          />
        </>
      )}

    </>
  );
}