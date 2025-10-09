"use client";

import { useState, useTransition } from 'react';
import Image from 'next/image';
import { getTelegramMessagesAction, rewriteTextAction, generateImageAction, sendPostAction, regeneratePromptAction } from '@/app/actions';

/**
 * Определяет структуру состояния для одного поста, который обрабатывается в интерфейсе.
 * Содержит как исходные данные, так и результаты обработки (рерайт, промпт, изображения),
 * а также флаги состояний для управления UI (например, isRewriting, isSending).
 */
interface PostState {
  id: number;
  originalText: string;
  reactions: number;
  cleanText?: string;
  originalCleanText?: string;
  prompt?: string | null;
  imageUrls?: string[];
  selectedImageUrl?: string;
  isRewriting: boolean;
  isGeneratingImage: boolean;
  isSending: boolean;
  isSent: boolean;
  isRegeneratingPrompt: boolean;
  isEditingText: boolean;
  isEditingPrompt: boolean;
}

/**
 * Основной компонент приложения, отвечающий за весь пользовательский интерфейс.
 * Позволяет пользователю вводить ID каналов, получать посты, выполнять рерайт,
 * генерировать изображения и отправлять результат в другой канал.
 */
export function MessageFetcher() {
  // Состояния для хранения ID каналов
  const [sourceChannelId, setSourceChannelId] = useState('');
  const [destinationChannelId, setDestinationChannelId] = useState('');
  // Состояние для хранения массива постов, загруженных из Telegram
  const [posts, setPosts] = useState<PostState[]>([]);
  // Состояние для отображения ошибок
  const [error, setError] = useState<string | null>(null);
  // Хук useTransition для управления состоянием загрузки без блокировки UI
  const [isFetching, startFetchingTransition] = useTransition();

  /**
   * Обработчик для получения постов из Telegram-канала.
   * Вызывается при отправке формы.
   */
  const handleFetchMessages = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setPosts([]);
    startFetchingTransition(async () => {
      const result = await getTelegramMessagesAction(sourceChannelId);
      if (result.error) {
        setError(result.error);
      } else if (result.data) {
        // Преобразуем полученные данные в начальное состояние для каждого поста
        const initialPosts = result.data.map((postData, index) => ({
          id: index,
          originalText: postData.text,
          reactions: postData.reactions,
          isRewriting: false,
          isGeneratingImage: false,
          isSending: false,
          isSent: false,
          isRegeneratingPrompt: false,
          isEditingText: false,
          isEditingPrompt: false,
        }));
        setPosts(initialPosts);
      }
    });
  };

  /**
   * Инициирует процесс рерайта текста для конкретного поста.
   * @param postId - ID поста для рерайта.
   */
  const handleRewrite = (postId: number) => {
    const post = posts.find(p => p.id === postId);
    if (!post) return;
    // Устанавливаем флаг загрузки и сбрасываем предыдущие результаты
    setPosts(posts.map(p => p.id === postId ? { ...p, isRewriting: true, isSent: false, imageUrls: undefined, selectedImageUrl: undefined, cleanText: undefined, prompt: undefined, isEditingText: false, isEditingPrompt: false } : p));
    startFetchingTransition(async () => {
      const result = await rewriteTextAction(post.originalText);
      // Обновляем состояние поста с результатами рерайта
      setPosts(prevPosts => prevPosts.map(p => {
        if (p.id === postId) {
          return {
            ...p,
            isRewriting: false,
            cleanText: result.data?.cleanText,
            originalCleanText: result.data?.cleanText, // Сохраняем исходный рерайт для сравнения
            prompt: result.data?.prompt
          };
        }
        return p;
      }));
    });
  };

  /**
   * Переключает режим редактирования для текста рерайта.
   * @param postId - ID поста.
   */
  const toggleEditTextMode = (postId: number) => {
    setPosts(posts.map(p => p.id === postId ? { ...p, isEditingText: !p.isEditingText } : p));
  };

  /**
   * Переключает режим редактирования для промпта.
   * @param postId - ID поста.
   */
  const toggleEditPromptMode = (postId: number) => {
    setPosts(posts.map(p => p.id === postId ? { ...p, isEditingPrompt: !p.isEditingPrompt } : p));
  };

  /**
   * Обновляет текст рерайта в состоянии при вводе в textarea.
   * @param postId - ID поста.
   * @param newText - Новый текст.
   */
  const handleTextChange = (postId: number, newText: string) => {
    setPosts(posts.map(p => p.id === postId ? { ...p, cleanText: newText } : p));
  };

  /**
   * Обновляет текст промпта в состоянии при вводе в textarea.
   * @param postId - ID поста.
   * @param newPrompt - Новый текст промпта.
   */
  const handlePromptChange = (postId: number, newPrompt: string) => {
    setPosts(posts.map(p => p.id === postId ? { ...p, prompt: newPrompt } : p));
  };

  /**
   * Инициирует повторную генерацию промпта на основе измененного текста рерайта.
   * @param postId - ID поста.
   */
  const handleRegeneratePrompt = (postId: number) => {
    const post = posts.find(p => p.id === postId);
    if (!post || !post.cleanText) return;
    setPosts(posts.map(p => p.id === postId ? { ...p, isRegeneratingPrompt: true } : p));
    startFetchingTransition(async () => {
      const result = await regeneratePromptAction(post.cleanText!);
      setPosts(prevPosts => prevPosts.map(p => {
        if (p.id === postId) {
          return {
            ...p,
            isRegeneratingPrompt: false,
            prompt: result.data,
            originalCleanText: p.cleanText // Обновляем "оригинал" для скрытия кнопки
          };
        }
        return p;
      }));
    });
  };

  /**
   * Инициирует генерацию изображений на основе промпта.
   * @param postId - ID поста.
   */
  const handleGenerateImage = (postId: number) => {
    const post = posts.find(p => p.id === postId);
    if (!post || !post.prompt || post.prompt === 'no prompt') return;
    setPosts(posts.map(p => p.id === postId ? { ...p, isGeneratingImage: true, isSent: false, imageUrls: undefined, selectedImageUrl: undefined } : p));
    startFetchingTransition(async () => {
      const result = await generateImageAction(post.prompt!);
      if (result.error) { alert(`Ошибка генерации изображения: ${result.error}`); }
      setPosts(prevPosts => prevPosts.map(p => p.id === postId ? { ...p, isGeneratingImage: false, imageUrls: result.data } : p));
    });
  };

  /**
   * Обрабатывает выбор изображения пользователем, сохраняя его URL.
   * @param postId - ID поста.
   * @param imageUrl - URL выбранного изображения.
   */
  const handleSelectImage = (postId: number, imageUrl: string) => {
    setPosts(posts.map(p => p.id === postId ? { ...p, selectedImageUrl: imageUrl } : p));
  };

  /**
   * Отправляет финальный пост (текст + выбранное изображение) в канал назначения.
   * @param postId - ID поста.
   */
  const handleSendPost = (postId: number) => {
    const post = posts.find(p => p.id === postId);
    if (!post || !post.cleanText || !post.selectedImageUrl || !destinationChannelId) { alert("Для отправки необходимо указать ID канала назначения, иметь готовый текст и ВЫБРАТЬ одно из изображений."); return; }
    setPosts(posts.map(p => p.id === postId ? { ...p, isSending: true } : p));
    startFetchingTransition(async () => {
      const result = await sendPostAction(destinationChannelId, post.cleanText!, post.selectedImageUrl!);
      if (result.error) {
        alert(`Ошибка отправки: ${result.error}`);
        setPosts(prevPosts => prevPosts.map(p => p.id === postId ? { ...p, isSending: false } : p));
      } else if (result.success) {
        setPosts(prevPosts => prevPosts.map(p => p.id === postId ? { ...p, isSending: false, isSent: true } : p));
      }
    });
  };

  // Отрисовка компонента
  return (
    <div>
      {/* Форма для ввода ID каналов и получения постов */}
      <form onSubmit={handleFetchMessages} className="mb-8 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <input type="text" value={sourceChannelId} onChange={(e) => setSourceChannelId(e.target.value)} placeholder="ID канала-источника (откуда читать)" required className="flex-grow bg-gray-800 border border-gray-700 rounded-lg px-4 py-4 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <input type="text" value={destinationChannelId} onChange={(e) => setDestinationChannelId(e.target.value)} placeholder="ID канала-назначения (куда постить)" required className="flex-grow bg-gray-800 border border-gray-700 rounded-lg px-4 py-4 focus:outline-none focus:ring-2 focus:ring-teal-500" />
        </div>
        <button type="submit" disabled={isFetching} className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-4 px-4 rounded-lg transition-colors cursor-pointer">
          {isFetching && posts.length === 0 ? 'Загрузка...' : 'Получить посты'}
        </button>
      </form>

      {/* Отображение ошибок или статуса загрузки */}
      {error && <div className="bg-red-900/50 border border-red-700 text-red-200 p-4 rounded-2xl text-center">{error}</div>}
      {isFetching && posts.length === 0 && <div className="text-center text-gray-400">Идет загрузка...</div>}

      {/* Список постов для обработки */}
      <div className="space-y-4 mt-4">
        {posts.map((post) => {
          // Вычисляемые переменные для условного рендеринга
          const showRegenerateButton = post.isEditingText && post.cleanText !== post.originalCleanText;
          const hasValidPrompt = post.prompt && post.prompt !== 'no prompt';

          return (
            <div key={post.id} className="border bg-gray-800 rounded-2xl p-4 transition-all duration-300 border-gray-700">
              {/* Блок с оригинальным текстом поста */}
              <h3 className="text-xl font-semibold text-gray-400 mb-2">Оригинал #{post.id + 1}</h3>
              <p className="text-gray-300 text-sm whitespace-pre-wrap">{post.originalText}</p>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-4 pt-3 border-t border-gray-700"><div className="flex items-center gap-1 text-amber-400 rounded-full px-2 py-0.5 text-xs font-bold ml-auto"><span>🏆</span><span>{post.reactions}</span></div></div>

              <div className="mt-4 pt-4 border-t border-dashed border-gray-700 space-y-3">
                {/* Кнопки основных действий: Рерайт и Генерация артов */}
                <div className="flex gap-4">
                  <button
                    onClick={() => handleRewrite(post.id)}
                    disabled={isFetching || post.isRewriting || post.isEditingText || post.isEditingPrompt}
                    className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white font-bold py-4 px-5 rounded-lg transition-colors text-sm w-full cursor-pointer disabled:cursor-not-allowed">
                    {post.isRewriting ? 'Рерайт...' : 'Сделать рерайт'}
                  </button>
                  <button
                    onClick={() => handleGenerateImage(post.id)}
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
                              onClick={() => handleRegeneratePrompt(post.id)}
                              disabled={post.isRegeneratingPrompt || isFetching}
                              className="bg-purple-700 hover:bg-purple-600 text-white text-xs font-bold py-3 px-3 rounded-lg disabled:bg-gray-600 cursor-pointer disabled:cursor-not-allowed">
                              {post.isRegeneratingPrompt ? 'Думаю...' : 'Обновить промпт'}
                            </button>
                          )}
                          <button
                            onClick={() => toggleEditTextMode(post.id)}
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
                            onChange={(e) => handleTextChange(post.id, e.target.value)}
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
                          <button onClick={() => toggleEditPromptMode(post.id)} className="bg-gray-700 hover:bg-gray-600 text-white text-xs font-bold py-3 px-3 rounded-lg">
                            {post.isEditingPrompt ? '✔️ Готово' : '✏️ Редактировать'}
                          </button>
                        )}
                      </div>

                      {post.isEditingPrompt && hasValidPrompt ? (
                        <div className="grid">
                          <p aria-hidden="true" className="invisible whitespace-pre-wrap text-gray-400 text-xs font-mono p-3 col-start-1 row-start-1">{post.prompt! + ' '}</p>
                          <textarea
                            value={post.prompt!}
                            onChange={(e) => handlePromptChange(post.id, e.target.value)}
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
                      <div>
                        <h4 className="text-sm font-bold text-green-400 mb-2">✅ Шаг 1: Готово! &nbsp; &nbsp; 👉 Шаг 2: Кликните на картинку для выбора</h4>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-3">
                          {post.imageUrls.map((url, index) => (
                            <Image
                              key={index}
                              src={url}
                              alt={`Generated Art Option ${index + 1}`}
                              width={512}
                              height={512}
                              onClick={() => handleSelectImage(post.id, url)}
                              className={`rounded-2xl cursor-pointer transition-all duration-200 border-4 ${
                                post.selectedImageUrl === url
                                  ? 'border-teal-500 opacity-100'
                                  : 'border-transparent opacity-60 hover:opacity-100'
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                    {/* Кнопка отправки поста, появляется после выбора изображения */}
                    {post.selectedImageUrl && (
                      <div className="mt-4 pt-4 border-t border-dashed border-gray-700">
                        <button onClick={() => handleSendPost(post.id)} disabled={isFetching || post.isSending || post.isSent} className="w-full bg-teal-600 hover:bg-teal-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-2 px-5 rounded-lg transition-colors text-sm">
                          {post.isSending ? 'Отправка...' : post.isSent ? 'Отправлено ✔️' : '🚀 Отправить выбранное в Telegram'}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  );
}
