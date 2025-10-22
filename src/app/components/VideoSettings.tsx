import { VideoModeSelector } from './VideoModeSelector';
import { StartingImageUpload } from './StartingImageUpload';
//import { ReferenceImageUpload } from './ReferenceImageUpload';
import { ReferenceImage, VideoGenerationMode, VideoModel, VideoDuration } from '@/types/stream';
import { InfoIcon } from './Icons';
import {
  SUPPORTED_DURATIONS,
  SUPPORTED_RESOLUTIONS,
  SUPPORTED_ASPECT_RATIOS,
  SUPPORTS_AUDIO,
  isResolutionAspectRatioCompatible,
  isResolutionDurationCompatible,
  getModelLimitations
} from '@/hooks/useVideoState';

interface VideoSettingsProps {
  generationMode: VideoGenerationMode;
  resolution: string;
  aspectRatio: string;
  selectedModel: VideoModel;
  duration: VideoDuration;
  startingImage: ReferenceImage | null;
  onModeChange: (mode: VideoGenerationMode) => void;
  onResolutionChange: (resolution: string) => void;
  onAspectRatioChange: (aspectRatio: string) => void;
  onModelChange: (model: VideoModel) => void;
  onDurationChange: (duration: VideoDuration) => void;
  onSetStartingImage: (file: File) => void;
  onClearStartingImage: () => void;
}

export function VideoSettings({
  generationMode,
  resolution,
  aspectRatio,
  selectedModel,
  duration,
  startingImage,
  onModeChange,
  onResolutionChange,
  onAspectRatioChange,
  onModelChange,
  onDurationChange,
  onSetStartingImage,
  onClearStartingImage
}: VideoSettingsProps) {
  const videoModels: VideoModel[] = ['Veo 2', 'Veo 3', 'Veo 3 Fast', 'Veo 3.1', 'Veo 3.1 Fast'];
  const availableDurations = SUPPORTED_DURATIONS[selectedModel];
  const availableResolutions = SUPPORTED_RESOLUTIONS[selectedModel];
  const availableAspectRatios = SUPPORTED_ASPECT_RATIOS[selectedModel];
  const supportsAudio = SUPPORTS_AUDIO[selectedModel];
  const modelLimitations = getModelLimitations(selectedModel);

  // Проверяем, нужно ли принудительно установить длительность 8 секунд для референсных изображений
  const hasReferenceImages = startingImage !== null;
  const shouldForce8Seconds = hasReferenceImages && (selectedModel === 'Veo 3.1' || selectedModel === 'Veo 3.1 Fast');

  return (
    <>
      {/* Выбор модели с описанием */}
      <div className="mb-6">
        <div className="flex gap-2 mb-3">
          <span className="text-sm text-gray-400 self-center mr-2">Модель:</span>
          <div className="flex flex-wrap gap-2">
            {videoModels.map((model) => (
              <button
                key={model}
                onClick={() => onModelChange(model)}
                className={`px-3 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors ${selectedModel === model
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                title={model}
              >
                {model}
              </button>
            ))}
          </div>
        </div>

        {/* Описание выбранной модели */}
        <div className="p-3 bg-gray-800/50 border border-gray-700 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <div className={`w-3 h-3 rounded-full ${supportsAudio ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className="text-sm font-medium text-gray-200">
              {supportsAudio ? 'С аудио' : 'Без звука'}
            </span>
          </div>
          <p className="text-xs text-gray-400">
            {modelLimitations.length > 0 
              ? `Ограничения: ${modelLimitations.join(', ')}`
              : 'Все опции доступны'
            }
          </p>
        </div>
      </div>

      {/* Выбор длительности */}
      <div className="mb-4">
        <div className="flex gap-2 mb-2">
          <span className="text-sm text-gray-400 self-center mr-2">Длительность:</span>
          {availableDurations.map((dur) => {
            const isDisabled = shouldForce8Seconds && dur !== '8';
            const isIncompatible = !isResolutionDurationCompatible(selectedModel, resolution, dur);
            const isActuallyDisabled = isDisabled || isIncompatible;
            
            return (
              <button
                key={dur}
                onClick={() => !isActuallyDisabled && onDurationChange(dur as VideoDuration)}
                disabled={isActuallyDisabled}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActuallyDisabled 
                    ? 'bg-gray-600 text-gray-500 cursor-not-allowed'
                    : duration === dur
                      ? 'bg-blue-600 text-white cursor-pointer'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600 cursor-pointer'
                }`}
                title={
                  isDisabled 
                    ? 'Только 8 секунд при использовании референсных изображений'
                    : isIncompatible
                      ? 'Несовместимо с текущим разрешением'
                      : `${dur} секунд`
                }
              >
                {dur}с
              </button>
            );
          })}
        </div>
        {shouldForce8Seconds && (
          <p className="text-xs text-yellow-400 mt-1">
            ⚠️ При использовании референсных изображений доступна только длительность 8 секунд
          </p>
        )}
      </div>

      {/* Выбор разрешения */}
      <div className="mb-4">
        <div className="flex gap-2 mb-2">
          <span className="text-sm text-gray-400 self-center mr-2">Разрешение:</span>
          {availableResolutions.map((res) => {
            const isIncompatibleWithAspectRatio = !isResolutionAspectRatioCompatible(selectedModel, res, aspectRatio);
            const isIncompatibleWithDuration = !isResolutionDurationCompatible(selectedModel, res, duration);
            const isDisabled = isIncompatibleWithAspectRatio || isIncompatibleWithDuration;
            
            return (
              <button
                key={res}
                onClick={() => !isDisabled && onResolutionChange(res)}
                disabled={isDisabled}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isDisabled 
                    ? 'bg-gray-600 text-gray-500 cursor-not-allowed'
                    : resolution === res
                      ? 'bg-blue-600 text-white cursor-pointer'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600 cursor-pointer'
                }`}
                title={
                  isDisabled 
                    ? 'Несовместимо с текущими настройками'
                    : res
                }
              >
                {res}
              </button>
            );
          })}
        </div>
        {selectedModel === 'Veo 2' && (
          <p className="text-xs text-yellow-400 mt-1">
            ⚠️ Veo 2 поддерживает только разрешение 720p
          </p>
        )}
      </div>

      {/* Выбор соотношения сторон */}
      <div className="mb-4">
        <div className="flex gap-2 mb-2">
          <span className="text-sm text-gray-400 self-center mr-2">Соотношение:</span>
          {availableAspectRatios.map((ratio) => {
            const isDisabled = !isResolutionAspectRatioCompatible(selectedModel, resolution, ratio);
            
            return (
              <button
                key={ratio}
                onClick={() => !isDisabled && onAspectRatioChange(ratio)}
                disabled={isDisabled}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isDisabled 
                    ? 'bg-gray-600 text-gray-500 cursor-not-allowed'
                    : aspectRatio === ratio
                      ? 'bg-blue-600 text-white cursor-pointer'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600 cursor-pointer'
                }`}
                title={
                  isDisabled 
                    ? 'Несовместимо с текущим разрешением'
                    : ratio
                }
              >
                {ratio}
              </button>
            );
          })}
        </div>
        {(selectedModel === 'Veo 3' || selectedModel === 'Veo 3 Fast') && (
          <p className="text-xs text-yellow-400 mt-1">
            ⚠️ Veo 3 поддерживает только соотношение 16:9
          </p>
        )}
      </div>

      {/* Выбор режима генерации */}
      <VideoModeSelector mode={generationMode} onModeChange={onModeChange} />

      {/* Информационная панель с текущими настройками */}
      <div className="mb-4 p-4 bg-blue-900/20 border border-blue-700/30 rounded-lg">
        <div className="flex items-start gap-2">
          <InfoIcon className="text-blue-400 text-sm w-4 h-4 mt-0.5" />
          <div className="text-sm text-blue-200">
            <p className="font-medium mb-2">Текущие настройки:</p>
            <div className="grid grid-cols-2 gap-2 text-xs text-blue-300">
              <div>
                <span className="font-medium">Модель:</span> {selectedModel}
              </div>
              <div>
                <span className="font-medium">Аудио:</span> {supportsAudio ? 'Да' : 'Нет'}
              </div>
              <div>
                <span className="font-medium">Длительность:</span> {duration}с
              </div>
              <div>
                <span className="font-medium">Разрешение:</span> {resolution}
              </div>
              <div>
                <span className="font-medium">Соотношение:</span> {aspectRatio}
              </div>
              <div>
                <span className="font-medium">Режим:</span> {generationMode === 'text-to-video' ? 'Текст в видео' : 'Изображение в видео'}
              </div>
            </div>
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