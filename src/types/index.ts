/**
 * Определяет структуру состояния для одного поста, который обрабатывается в интерфейсе.
 * Содержит как исходные данные, так и результаты обработки (рерайт, промпт, изображения),
 * а также флаги состояний для управления UI (например, isRewriting, isSending).
 */
export interface PostState {
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

export interface HoveredImage {
    postId: number;
    imageUrl: string;
}