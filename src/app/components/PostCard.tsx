import { PostState, HoveredImage } from '@/types';
import { ImageGallery } from './ImageGallery';

interface PostCardProps {
  post: PostState;
  hoveredImage: HoveredImage | null;
  onHoverImage: (image: HoveredImage | null) => void;
  onRewrite: (postId: number) => void;
  onGenerateImage: (postId: number) => void;
  onSelectImage: (postId: number, imageUrl: string) => void;
  onSendPost: (postId: number) => void;
  onToggleEditText: (postId: number) => void;
  onToggleEditPrompt: (postId: number) => void;
  onTextChange: (postId: number, text: string) => void;
  onPromptChange: (postId: number, prompt: string) => void;
  onRegeneratePrompt: (postId: number) => void;
  isFetching: boolean;
  destinationChannelId: string;
}

export function PostCard({ 
  post, 
  hoveredImage, 
  onHoverImage,
  onRewrite,
  onGenerateImage,
  onSelectImage,
  onSendPost,
  onToggleEditText,
  onToggleEditPrompt,
  onTextChange,
  onPromptChange,
  onRegeneratePrompt,
  isFetching,
}: PostCardProps) {
  // Вычисляемые переменные для условного рендеринга
  const showRegenerateButton = post.isEditingText && post.cleanText !== post.originalCleanText;
  const hasValidPrompt = post.prompt && post.prompt !== 'no prompt';

  return (
    <div className="border bg-gray-800 rounded-2xl p-4 transition-all duration-300 border-gray-700">
      {/* Блок с оригинальным текстом поста */}
      <h3 className="text-xl font-semibold text-gray-400 mb-2">Оригинал #{post.id + 1}</h3>
      <p className="text-gray-300 text-sm whitespace-pre-wrap">{post.originalText}</p>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-4 pt-3 border-t border-gray-700">
        <div className="flex items-center gap-1 text-amber-400 rounded-full px-2 py-0.5 text-xs font-bold ml-auto">
          <span>🏆</span><span>{post.reactions}</span>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-dashed border-gray-700 space-y-3">
        {/* Кнопки основных действий: Рерайт и Генерация артов */}
        <div className="flex gap-4">
          <button
            onClick={() => onRewrite(post.id)}
            disabled={isFetching || post.isRewriting || post.isEditingText || post.isEditingPrompt}
            className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white font-bold py-4 px-5 rounded-lg transition-colors text-sm w-full cursor-pointer disabled:cursor-not-allowed">
            {post.isRewriting ? 'Рерайт...' : 'Сделать рерайт'}
          </button>
          <button
            onClick={() => onGenerateImage(post.id)}
            disabled={isFetching || !hasValidPrompt || post.isGeneratingImage || post.isEditingText || post.isEditingPrompt}
            className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white font-bold py-4 px-5 rounded-lg transition-colors text-sm w-full cursor-pointer disabled:cursor-not-allowed">
            {post.isGeneratingImage ? 'Генерация (x3)...' : 'Создать арты (x3)'}
          </button>
        </div>

        {/* Блок с результатами обработки, появляется после рерайта */}
        {post.cleanText && (
          <div className="mt-4 pt-4 border-t-2 border-dashed border-purple-400/30 space-y-4 animate-fade-in">

            {/* Блок редактирования текста рерайта */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <h4 className="text-sm font-bold text-purple-400">💡 Рерайт текста:</h4>
                <div className="flex items-center gap-2">
                  {showRegenerateButton && (
                    <button
                      onClick={() => onRegeneratePrompt(post.id)}
                      disabled={post.isRegeneratingPrompt || isFetching}
                      className="bg-purple-700 hover:bg-purple-600 text-white text-xs font-bold py-3 px-3 rounded-lg disabled:bg-gray-600 cursor-pointer disabled:cursor-not-allowed">
                      {post.isRegeneratingPrompt ? 'Думаю...' : 'Обновить промпт'}
                    </button>
                  )}
                  <button
                    onClick={() => onToggleEditText(post.id)}
                    className="bg-gray-700 hover:bg-gray-600 text-white text-xs font-bold py-3 px-3 rounded-lg cursor-pointer disabled:cursor-not-allowed">
                    {post.isEditingText ? '✔️ Готово' : '✏️ Редактировать'}
                  </button>
                </div>
              </div>
              {post.isEditingText ? (
                <div className="grid">
                  <p aria-hidden="true" className="invisible whitespace-pre-wrap text-gray-300 text-sm p-3 col-start-1 row-start-1">{post.cleanText + ' '}</p>
                  <textarea
                    value={post.cleanText}
                    onChange={(e) => onTextChange(post.id, e.target.value)}
                    className="w-full bg-gray-900 border border-purple-500 ring-1 ring-purple-500 rounded-lg p-3 text-gray-300 text-sm whitespace-pre-wrap resize-none overflow-hidden col-start-1 row-start-1 transition-colors"
                    autoFocus
                  />
                </div>
              ) : (
                <p className="text-gray-300 text-sm bg-gray-900 p-3 rounded-lg whitespace-pre-wrap">{post.cleanText}</p>
              )}
            </div>

            {/* Блок редактирования промпта */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <h4 className="text-sm font-bold text-purple-400">🎨 Промпт для изображения (Eng):</h4>
                {hasValidPrompt && (
                  <button onClick={() => onToggleEditPrompt(post.id)} className="bg-gray-700 hover:bg-gray-600 text-white text-xs font-bold py-3 px-3 rounded-lg">
                    {post.isEditingPrompt ? '✔️ Готово' : '✏️ Редактировать'}
                  </button>
                )}
              </div>

              {post.isEditingPrompt && hasValidPrompt ? (
                <div className="grid">
                  <p aria-hidden="true" className="invisible whitespace-pre-wrap text-gray-400 text-xs font-mono p-3 col-start-1 row-start-1">{post.prompt! + ' '}</p>
                  <textarea
                    value={post.prompt!}
                    onChange={(e) => onPromptChange(post.id, e.target.value)}
                    className="w-full bg-gray-900 border border-purple-500 ring-1 ring-purple-500 rounded-lg p-3 text-gray-400 text-xs font-mono resize-none overflow-hidden col-start-1 row-start-1 transition-colors"
                    autoFocus
                  />
                </div>
              ) : (
                <div className={`p-3 rounded-lg text-xs ${hasValidPrompt ? 'bg-gray-900 text-gray-400 font-mono' : 'bg-yellow-900/30 border border-dashed border-yellow-600/50 text-yellow-400'}`}>
                  {hasValidPrompt ? (
                    <span>{post.prompt}</span>
                  ) : (
                    <div>
                      <p className="font-semibold text-yellow-300 text-sm">Не удалось создать промпт.</p>
                      <p className="mt-1">Текст слишком короткий или абстрактный. Отредактируйте рерайт, добавив больше деталей, а затем нажмите <strong>&quot;🔄 Обновить промпт&quot;</strong>.</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Блок с сгенерированными изображениями */}
            {post.imageUrls && (
              <ImageGallery
                imageUrls={post.imageUrls}
                selectedImageUrl={post.selectedImageUrl}
                hoveredImage={hoveredImage}
                onHoverImage={onHoverImage}
                onSelectImage={(imageUrl) => onSelectImage(post.id, imageUrl)}
                postId={post.id}
              />
            )}

            {/* Кнопка отправки поста, появляется после выбора изображения */}
            {post.selectedImageUrl && (
              <div className="mt-4 pt-4 border-t border-dashed border-gray-700 text-center">
                <button
                  onClick={() => onSendPost(post.id)}
                  disabled={isFetching || post.isSending || post.isSent}
                  className="w-fit mx-auto bg-teal-600 hover:bg-teal-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-4 px-5 rounded-lg transition-colors text-sm"
                >
                  {post.isSending ? 'Отправка...' : post.isSent ? 'Отправлено ✔️' : '🚀 Отправить выбранное в Telegram'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}