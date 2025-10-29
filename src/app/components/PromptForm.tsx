interface PromptFormProps {
  prompt: {
    value: string;
    onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
    onBlur: () => void;
    canSubmit: boolean;
    setTouched: (touched: boolean) => void;
    setError: (error: string) => void;
    length: number;
    error?: string;
    touched: boolean;
  };
  mode: 'text' | 'html' | 'images' | 'videos' | 'research';
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  isStreaming: boolean;
  isParsingPrompts: boolean;
  isGeneratingImages: boolean;
  requestCount: number;
  selectedImageModel: string | null;
}

export function PromptForm({
  prompt,
  mode,
  onSubmit,
  isStreaming,
  isParsingPrompts,
  isGeneratingImages,
  requestCount,
  selectedImageModel
}: PromptFormProps) {
  return (
    <form onSubmit={onSubmit} className="flex flex-col items-center sm:flex-row gap-3 sm:gap-4">
      <div className="flex-1">
        <label className="sr-only" htmlFor="prompt">Prompt</label>
        <textarea
          id="prompt"
          placeholder={
            mode === 'html'
              ? 'Опишите HTML страницу, которую вы хотите получить...'
              : mode === 'images'
                ? 'Введите промпт или несколько промптов для изображений, разделенных абзацами...'
                : mode === 'videos'
                ? 'Введите промпт или несколько промптов для видео, разделенных абзацами...'
                : mode === 'research'
                ? 'Введите вопрос для исследования с помощью Google Search...'
                : 'Введите ваш промпт...'
          }
          className="w-full border border-gray-700 rounded-lg px-4 py-4 min-h-[250px] sm:min-h-[120px] bg-(--background-color) focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 custom-scrollbar"
          value={prompt.value}
          onChange={prompt.onChange}
          onBlur={prompt.onBlur}
          maxLength={50000}
          aria-invalid={Boolean(prompt.touched && prompt.error)}
          aria-describedby="prompt-help prompt-error"
        />
        <div className="mt-2 flex items-center justify-between text-sm text-gray-400">
          <span id="prompt-help">{prompt.length}/50000</span>
          {prompt.touched && prompt.error && (
            <span id="prompt-error" className="text-red-400">{prompt.error}</span>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:gap-3 sm:w-auto">
        <button
          type="submit"
          className="bg-(--btn-active-color) disabled:bg-(--btn-color) disabled:cursor-not-allowed border border-gray-700 text-white font-bold py-3 px-4 rounded-lg transition-all duration-300 hover:scale-105 disabled:scale-100 cursor-pointer w-full sm:w-auto"
          disabled={!prompt.canSubmit || isStreaming || isParsingPrompts || isGeneratingImages}
        >
          {isParsingPrompts
            ? 'Парсинг...'
            : isGeneratingImages
              ? 'Генерация изображений...'
              : isStreaming
                ? 'Генерация...'
                : mode === 'html'
                  ? `Генерация ${requestCount} HTML${requestCount > 1 ? 's' : ''}`
                  : mode === 'images'
                    ? `Генерация ${selectedImageModel || 'Изображения'}`
                  : mode === 'videos'
                    ? `Генерация ${selectedImageModel || 'Видео'}`
                    : mode === 'research'
                    ? 'Исследование...'
                    : `Генерация ${requestCount} Текст${requestCount > 1 ? 's' : ''}`
          }
        </button>
      </div>
    </form>
  );
}