import { VideoGenerationResult, GeneratedVideo } from '@/types/stream';
import { ErrorIcon, VideoIcon, SpinnerIcon } from './Icons';

interface VideoResultsProps {
  videoResults: VideoGenerationResult[];
  //parsedPrompts: string[];
  onDownloadVideo: (video: GeneratedVideo, filename: string) => void;
  onCopyPrompt: (text: string) => void;
}

export function VideoResults({
  videoResults,
  //parsedPrompts,
  //selectedVideoModel,
  onDownloadVideo,
  onCopyPrompt
}: VideoResultsProps) {
  return (
    <div className="space-y-6">
      {videoResults.map((result: VideoGenerationResult, index: number) => (
        <div key={index} className="flex gap-4">
          {/* Блок с промптом - 30% ширины */}
          <div className="w-[30%] bg-gray-800/50 border border-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium text-gray-300">Промпт #{index + 1}</h4>
              <button
                onClick={() => onCopyPrompt(result.prompt)}
                className="text-gray-400 hover:text-gray-200 transition-colors p-1 rounded hover:bg-gray-700"
                title="Копировать промпт"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </button>
            </div>
            <p className="text-gray-400 text-sm">{result.prompt}</p>

            {/* Показываем переведенный промпт, если он был переведен */}
            {result.translatedPrompt && result.wasTranslated && (
              <div className="mt-2 p-2 bg-gray-700/50 rounded text-xs">
                <div className="text-gray-500 mb-1">🌐 Translated:</div>
                <div className="text-!gray-300">{result.translatedPrompt}</div>
              </div>
            )}

            <div className="mt-2 flex items-center gap-2">
              <span className={`text-xs px-2 py-1 rounded ${result.status === 'loading'
                ? 'bg-blue-900/40 text-blue-300'
                : result.status === 'done'
                  ? 'bg-green-900/30 text-green-300'
                  : result.status === 'error'
                    ? 'bg-red-900/30 text-red-300'
                    : 'bg-gray-700 text-gray-300'
                }`}>
                {result.status === 'loading' ? 'Генерация...' :
                  result.status === 'done' ? 'Готово' :
                    result.status === 'error' ? 'Ошибка' : 'Ожидание'}
              </span>
              {/* {selectedVideoModel && (
                <span className="text-xs px-2 py-1 rounded bg-gray-700 text-gray-300">
                  {selectedVideoModel}
                </span>
              )} */}
              {result.hasSlavicPrompts && (
                <span className="text-xs px-2 py-1 rounded bg-blue-900/30 text-blue-300" title="Применены подсказки славянской внешности">
                  🇷🇺 Slavic
                </span>
              )}
            </div>
          </div>

          {/* Блок с видео - 70% ширины */}
          <div className="w-[70%] flex gap-4">
            {result.status === 'loading' ? (
              <div className="flex-1 bg-gray-800/50 border border-gray-700 rounded-lg p-6 flex items-center justify-center min-h-[200px]">
                <div className="text-center text-gray-500">
                  <div className="animate-spin text-4xl mb-2">
                    <SpinnerIcon className="w-12 h-12 mx-auto text-blue-400" />
                  </div>
                  <p className="text-sm">Генерация видео...</p>
                </div>
              </div>
            ) : result.status === 'error' ? (
              <div className="flex-1 bg-red-900/20 border border-red-700 rounded-lg p-6 flex items-center justify-center min-h-[200px]">
                <div className="text-center text-red-400">
                  <ErrorIcon className="w-12 h-12 mx-auto text-red-400" />
                  <p className="text-sm">Ошибка генерации</p>
                  <p className="text-xs text-red-500 mt-1">{result.error}</p>
                </div>
              </div>
            ) : (
              <div className="flex-1 bg-gray-800/50 border border-gray-700 rounded-lg p-2 flex flex-col min-h-[200px]">
                {/* Кнопка скачивания */}
                <div className="flex justify-end mb-2">
                  <button
                    onClick={() => onDownloadVideo(
                      result.video,
                      `video-${index + 1}.mp4`
                    )}
                    className="text-gray-400 hover:text-gray-200 transition-colors p-1 rounded hover:bg-gray-700"
                    title="Скачать видео"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </button>
                </div>

                {/* Видео */}
                <div className="flex-1 flex items-center justify-center">
                  {result.video.videoBytes ? (
                    <video
                      src={`data:${result.video.mimeType};base64,${result.video.videoBytes}`}
                      controls
                      className="max-w-full max-h-full rounded"
                      style={{ maxHeight: '400px' }}
                    >
                      Ваш браузер не поддерживает видео.
                    </video>
                  ) : (
                    <div className="text-center text-gray-500">
                      <VideoIcon className="w-12 h-12 mx-auto text-blue-400" />
                      <p className="text-sm">Нет видео</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}