import { useState, useTransition, useEffect } from 'react';
import { PostState } from '@/types';
import { getTelegramMessagesAction, rewriteTextAction, generateImageAction, sendPostAction, regeneratePromptAction } from '@/app/actions';

const STORAGE_KEY = 'tg_parser_state_v1';

export function useMessageFetcher() {
	const [sourceChannelId, setSourceChannelId] = useState('');
	const [destinationChannelId, setDestinationChannelId] = useState('');
	const [posts, setPosts] = useState<PostState[]>([]);
	const [error, setError] = useState<string | null>(null);
	const [isFetching, startFetchingTransition] = useTransition();
	const [hoveredImage, setHoveredImage] = useState<{ postId: number, imageUrl: string } | null>(null);


	const handleSourceChange = (value: string) => {
		setSourceChannelId(value);
		if (value.trim() === '') {
			setPosts([]);
			setError(null);
			try { localStorage.removeItem(STORAGE_KEY); } catch { }
		}
	};

	/**
 * Обработчик для получения постов из Telegram-канала.
 * Вызывается при отправке формы.
 */
	const handleFetchMessages = (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (!sourceChannelId.trim()) { setError('Укажите ID канала'); return; }

		setError(null);
		// очищаем, т.к. это “новая загрузка” (если канал сменился — сброс уместен)
		setPosts([]);

		startFetchingTransition(async () => {
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

	return {
    // Состояния
    sourceChannelId,
    destinationChannelId,
    posts,
    error,
    isFetching,
    hoveredImage,
    
    // Сеттеры
    setSourceChannelId,
    setDestinationChannelId,
    setHoveredImage,
    
    // Обработчики
    handleSourceChange,
    handleFetchMessages,
    handleRewrite,
    toggleEditTextMode,
    toggleEditPromptMode,
    handleTextChange,
    handlePromptChange,
    handleRegeneratePrompt,
    handleGenerateImage,
    handleSelectImage,
    handleSendPost,
  };

}
