"use client";

import { useState, useTransition } from 'react';
import { getTelegramMessagesAction, rewriteTextAction, generateImageAction, sendPostAction } from '@/app/actions';

interface PostState {
  id: number;
  originalText: string;
  reactions: number;
  cleanText?: string;
  prompt?: string | null;
  imageUrl?: string;
  isRewriting: boolean;
  isGeneratingImage: boolean;
  isSending: boolean;
  isSent: boolean;
}

export function MessageFetcher() {
  const [sourceChannelId, setSourceChannelId] = useState('');
  const [destinationChannelId, setDestinationChannelId] = useState('');

  const [posts, setPosts] = useState<PostState[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isFetching, startFetchingTransition] = useTransition();

  const handleFetchMessages = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setPosts([]);

    startFetchingTransition(async () => {
      // Используем sourceChannelId для получения постов
      const result = await getTelegramMessagesAction(sourceChannelId);
      if (result.error) {
        setError(result.error);
      } else if (result.data) {
        const initialPosts = result.data.map((postData, index) => ({
          id: index,
          originalText: postData.text,
          reactions: postData.reactions,
          isRewriting: false,
          isGeneratingImage: false,
          isSending: false,
          isSent: false,
        }));
        setPosts(initialPosts);
      }
    });
  };

  const handleRewrite = (postId: number) => {
    const post = posts.find(p => p.id === postId);
    if (!post) return;
    setPosts(posts.map(p => p.id === postId ? { ...p, isRewriting: true, isSent: false, imageUrl: undefined, cleanText: undefined, prompt: undefined } : p));
    startFetchingTransition(async () => {
      const result = await rewriteTextAction(post.originalText);
      setPosts(prevPosts => prevPosts.map(p => {
        if (p.id === postId) {
          return { ...p, isRewriting: false, cleanText: result.data?.cleanText, prompt: result.data?.prompt };
        }
        return p;
      }));
    });
  };

  const handleGenerateImage = (postId: number) => {
    const post = posts.find(p => p.id === postId);
    if (!post || !post.prompt || post.prompt === 'no prompt') return;
    setPosts(posts.map(p => p.id === postId ? { ...p, isGeneratingImage: true, isSent: false, imageUrl: undefined } : p));
    startFetchingTransition(async () => {
      const result = await generateImageAction(post.prompt!);
      setPosts(prevPosts => prevPosts.map(p => {
        if (p.id === postId) {
          return { ...p, isGeneratingImage: false, imageUrl: result.data };
        }
        return p;
      }));
    });
  };

  const handleSendPost = (postId: number) => {
    const post = posts.find(p => p.id === postId);

    // Теперь проверяем destinationChannelId
    if (!post || !post.cleanText || !post.imageUrl || !destinationChannelId) {
      alert("Для отправки необходимо указать ID канала назначения, а также иметь готовый текст и изображение.");
      return;
    }

    setPosts(posts.map(p => p.id === postId ? { ...p, isSending: true } : p));

    startFetchingTransition(async () => {
      // И передаем в экшен именно destinationChannelId
      const result = await sendPostAction(destinationChannelId, post.cleanText!, post.imageUrl!);

      if (result.error) {
        alert(`Ошибка отправки: ${result.error}`);
        setPosts(prevPosts => prevPosts.map(p => p.id === postId ? { ...p, isSending: false } : p));
      } else if (result.success) {
        setPosts(prevPosts => prevPosts.map(p => p.id === postId ? { ...p, isSending: false, isSent: true } : p));
      }
    });
  };

  return (
    <div>
      <form onSubmit={handleFetchMessages} className="mb-8 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={sourceChannelId}
            onChange={(e) => setSourceChannelId(e.target.value)}
            placeholder="ID канала-источника (откуда читать)"
            required
            className="flex-grow bg-gray-800 border border-gray-700 rounded-md px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="text"
            value={destinationChannelId}
            onChange={(e) => setDestinationChannelId(e.target.value)}
            placeholder="ID канала-назначения (куда постить)"
            required
            className="flex-grow bg-gray-800 border border-gray-700 rounded-md px-4 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>
        <button type="submit" disabled={isFetching} className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded-md transition-colors">
          {isFetching && posts.length === 0 ? 'Загрузка...' : 'Получить посты'}
        </button>
      </form>

      {error && <div className="bg-red-900/50 border border-red-700 text-red-200 p-4 rounded-lg text-center">{error}</div>}
      {isFetching && posts.length === 0 && <div className="text-center text-gray-400">Идет загрузка...</div>}
      <div className="space-y-4 mt-4">
        {posts.map((post) => (
          <div key={post.id} className="border bg-gray-800 rounded-lg p-4 transition-all duration-300 border-gray-700">
            <h3 className="text-xl font-semibold text-gray-400 mb-2">Оригинал #{post.id + 1}</h3>
            <p className="text-gray-300 text-sm whitespace-pre-wrap">{post.originalText}</p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-4 pt-3 border-t border-gray-700">
              <div className="flex items-center gap-1 text-amber-400 rounded-full px-2 py-0.5 text-xs font-bold ml-auto">
                <span>🏆</span><span>{post.reactions}</span>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-dashed border-gray-700 space-y-3">
              <div className="flex gap-4">
                <button onClick={() => handleRewrite(post.id)} disabled={isFetching || post.isRewriting} className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white font-bold py-2 px-5 rounded-md transition-colors text-sm w-full">
                  {post.isRewriting ? 'Рерайт...' : '✨ Сделать рерайт'}
                </button>
                <button onClick={() => handleGenerateImage(post.id)} disabled={isFetching || !post.prompt || post.prompt === 'no prompt' || post.isGeneratingImage} className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white font-bold py-2 px-5 rounded-md transition-colors text-sm w-full">
                  {post.isGeneratingImage ? 'Генерация...' : '🎨 Создать арт'}
                </button>
              </div>

              {post.cleanText && (
                <div className="mt-4 pt-4 border-t-2 border-dashed border-purple-400/30 space-y-4 animate-fade-in">
                  <div>
                    <h4 className="text-sm font-bold text-purple-400 mb-2">💡 Рерайт текста:</h4>
                    <p className="text-gray-300 text-sm bg-gray-900 p-3 rounded-md whitespace-pre-wrap">{post.cleanText}</p>
                  </div>
                  {post.prompt && post.prompt !== 'no prompt' && (<div><h4 className="text-sm font-bold text-purple-400 mb-2">🎨 Промпт для изображения (Eng):</h4><p className="text-gray-400 text-xs bg-gray-900 p-3 rounded-md font-mono">{post.prompt}</p></div>)}
                  {post.imageUrl && (<div><h4 className="text-sm font-bold text-green-400 mb-2">🖼️ Результат:</h4><img src={post.imageUrl} alt="Generated Art" className="rounded-lg w-full" /></div>)}

                  {post.imageUrl && (
                    <div className="mt-4 pt-4 border-t border-dashed border-gray-700">
                      <button
                        onClick={() => handleSendPost(post.id)}
                        disabled={isFetching || post.isSending || post.isSent}
                        className="w-full bg-teal-600 hover:bg-teal-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-2 px-5 rounded-md transition-colors text-sm"
                      >
                        {post.isSending ? 'Отправка...' : post.isSent ? 'Отправлено ✔️' : '🚀 Отправить в Telegram'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
