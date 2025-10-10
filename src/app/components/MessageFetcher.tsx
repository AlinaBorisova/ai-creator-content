"use client";

import { PostCard } from './PostCard';
import { ChannelInputs } from './ChannelInputs';
import { useMessageFetcher } from '@/hooks/useMessageFetcher';

/**
 * Основной компонент приложения, отвечающий за весь пользовательский интерфейс.
 * Позволяет пользователю вводить ID каналов, получать посты, выполнять рерайт,
 * генерировать изображения и отправлять результат в другой канал.
 */
export function MessageFetcher() {
  const {
    // Состояния
    sourceChannelId,
    destinationChannelId,
    posts,
    error,
    isFetching,
    hoveredImage,
    
    // Сеттеры
    setDestinationChannelId,
    setHoveredImage,
    
    // Обработчики
    handleSourceChange,
    handleFetchMessages,
    handleRewrite,
    handleGenerateImage,
    handleSelectImage,
    handleSendPost,
    toggleEditTextMode,
    toggleEditPromptMode,
    handleTextChange,
    handlePromptChange,
    handleRegeneratePrompt,
  } = useMessageFetcher();

  return (
    <div>
      {/* Форма для ввода ID каналов и получения постов */}
      <ChannelInputs
        sourceChannelId={sourceChannelId}
        destinationChannelId={destinationChannelId}
        onSourceChange={handleSourceChange}
        onDestinationChange={setDestinationChannelId}
        onSubmit={handleFetchMessages}
        isFetching={isFetching}
        error={error}
        postsCount={posts.length}
      />

      {/* Список постов для обработки */}
      <div className="space-y-4 mt-4">
        {posts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            hoveredImage={hoveredImage}
            onHoverImage={setHoveredImage}
            onRewrite={handleRewrite}
            onGenerateImage={handleGenerateImage}
            onSelectImage={handleSelectImage}
            onSendPost={handleSendPost}
            onToggleEditText={toggleEditTextMode}
            onToggleEditPrompt={toggleEditPromptMode}
            onTextChange={handleTextChange}
            onPromptChange={handlePromptChange}
            onRegeneratePrompt={handleRegeneratePrompt}
            isFetching={isFetching}
            destinationChannelId={destinationChannelId}
          />
        ))}
      </div>
    </div>
  );
}