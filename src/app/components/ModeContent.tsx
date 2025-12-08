import { Mode, StreamState, ImageGenerationResult, VideoGenerationResult } from '@/types/stream';
import { SEOArticleResult } from '@/types/stream';
import { ImageResults } from './ImageResults';
import { VideoResults } from './VideoResults';
import { TextResults } from './TextResults';
import { ResearchResults } from './ResearchResults';
import { SEOArticleResults } from './SEOArticleResults';
import { ImageIcon, VideoIcon } from './Icons';
import { downloadImage, copyPromptToClipboard } from '@/utils/imageUtils';
import { downloadVideo } from '@/utils/videoUtils';

interface ModeContentProps {
  mode: Mode;
  streams: StreamState[];
  imageResults: ImageGenerationResult[];
  videoResults: VideoGenerationResult[];
  articleResult: SEOArticleResult | null;
  editingStates: boolean[];
  openCodePanels: boolean[];
  iframeHeights: number[];
  selectedImageModel: string | null;
  imageCount: number;
  videoState: {
    selectedModel: string;
    resolution: string;
    videoCount: number;
  };
  onToggleEdit: (index: number) => void;
  onUpdateText: (index: number, newText: string) => void;
  onCopyToClipboard: (index: number) => void;
  onAbort: (index: number) => void;
  onToggleCodePanel: (index: number) => void;
  onAdjustIframeHeight: (iframe: HTMLIFrameElement, index: number) => void;
  onDownloadImage: typeof downloadImage;
  onCopyPrompt: typeof copyPromptToClipboard;
  onDownloadVideo: typeof downloadVideo;
  onAbortImageGeneration: (index: number) => void;
  onAbortVideoGeneration: (index: number) => void;
  onRegenerateImage: (placeholderId: string) => void;
  onRegenerateSingleImage: (placeholderId: string, imageIndex: number) => void;
  onAbortImageGenerationSEO: (placeholderId: string) => void;
  onRetry?: (index: number) => void;
}

export function ModeContent({
  mode,
  streams,
  imageResults,
  videoResults,
  articleResult,
  editingStates,
  openCodePanels,
  iframeHeights,
  selectedImageModel,
  imageCount,
  videoState,
  onToggleEdit,
  onUpdateText,
  onCopyToClipboard,
  onAbort,
  onToggleCodePanel,
  onAdjustIframeHeight,
  onDownloadImage,
  onCopyPrompt,
  onDownloadVideo,
  onAbortImageGeneration,
  onAbortVideoGeneration,
  onRegenerateImage,
  onRegenerateSingleImage,
  onAbortImageGenerationSEO,
  onRetry,
}: ModeContentProps) {
  if (mode === 'images' && imageResults.length > 0) {
    return (
      <ImageResults
        imageResults={imageResults}
        selectedImageModel={selectedImageModel}
        imageCount={imageCount}
        onDownloadImage={onDownloadImage}
        onCopyPrompt={onCopyPrompt}
        onAbort={onAbortImageGeneration}
      />
    );
  }

  if (mode === 'images') {
    return (
      <div className="text-center py-12">
        <ImageIcon className="w-16 h-16 mx-auto text-gray-400" />
        <h3 className="text-xl font-semibold text-gray-300 mb-2">Режим генерации изображений</h3>
        <p className="text-gray-500 mb-4">
          Введите несколько промптов для изображений, разделенных абзацами
        </p>
        <p className="text-sm text-gray-600">
          Каждый абзац будет обработан как отдельный промпт для генерации изображения
        </p>
        {selectedImageModel && (
          <p className="text-sm text-blue-400 mt-2">
            Выбрана модель: {selectedImageModel} | Изображений на промпт: {imageCount}
          </p>
        )}
      </div>
    );
  }

  if (mode === 'videos' && videoResults.length > 0) {
    return (
      <VideoResults
        videoResults={videoResults}
        onDownloadVideo={onDownloadVideo}
        onCopyPrompt={onCopyPrompt}
        onAbort={onAbortVideoGeneration}
      />
    );
  }

  if (mode === 'videos') {
    return (
      <div className="text-center py-12">
        <VideoIcon className="w-16 h-16 mx-auto text-gray-400" />
        <h3 className="text-xl font-semibold text-gray-300 mb-2">Режим генерации видео</h3>
        <p className="text-gray-500 mb-4">
          Введите промпт или несколько промптов для генерации видео, разделенных абзацами
        </p>
        <p className="text-sm text-gray-600">
          Каждый абзац будет обработан как отдельный промпт для генерации видео
        </p>
        {videoState.selectedModel && (
          <p className="text-sm text-blue-400 mt-2">
            Выбрана модель: {videoState.selectedModel} | Длительность: 4-8с (автоматически) | Разрешение: {videoState.resolution}
          </p>
        )}
      </div>
    );
  }

  if (mode === 'seo-article') {
    return (
      <SEOArticleResults
        articleResult={articleResult}
        onRegenerateImage={onRegenerateImage}
        onRegenerateSingleImage={onRegenerateSingleImage}
        onAbortImageGeneration={onAbortImageGenerationSEO}
        onDownloadImage={onDownloadImage}
      />
    );
  }

  if (mode === 'research') {
    return (
      <ResearchResults
        streams={streams}
        editingStates={editingStates}
        openCodePanels={openCodePanels}
        iframeHeights={iframeHeights}
        onToggleEdit={onToggleEdit}
        onUpdateText={onUpdateText}
        onCopyToClipboard={onCopyToClipboard}
        onAbort={onAbort}
        onToggleCodePanel={onToggleCodePanel}
        onAdjustIframeHeight={onAdjustIframeHeight}
        onRetry={onRetry}
      />
    );
  }

  return (
    <TextResults
      streams={streams}
      mode={mode}
      editingStates={editingStates}
      openCodePanels={openCodePanels}
      iframeHeights={iframeHeights}
      onToggleEdit={onToggleEdit}
      onUpdateText={onUpdateText}
      onCopyToClipboard={onCopyToClipboard}
      onAbort={onAbort}
      onToggleCodePanel={onToggleCodePanel}
      onAdjustIframeHeight={onAdjustIframeHeight}
      onRetry={onRetry}
    />
  );
}