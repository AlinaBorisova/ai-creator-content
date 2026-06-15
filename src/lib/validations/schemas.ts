import { z } from 'zod';

// Общие схемы
export const aspectRatioSchema = z.enum([
  '1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'
]);

export const resolutionSchema = z.enum(['1K', '2K', '4K']);

export const geminiModelVersionSchema = z.enum([
  'gemini-2.5-pro',
  'gemini-2.5-flash'
]);

export const imagenModelVersionSchema = z.enum([
  'imagen-4.0-generate-001',
  'imagen-4.0-ultra-generate-001',
  'imagen-4.0-fast-generate-001'
]);

export const veoModelVersionSchema = z.enum([
  'veo-2.0-generate-001',
  'veo-3.0-generate-001',
  'veo-3.0-fast-generate-001',
  'veo-3.1-generate-001',
  'veo-3.1-fast-generate-001'
]);

export const videoDurationSchema = z.enum(['4', '5', '6', '8']);

export const videoResolutionSchema = z.enum(['720p', '1080p']);

export const modeSchema = z.enum([
  'text',
  'html',
  'images',
  'videos',
  'research',
  'seo-article'
]);

// Схема для Gemini Image API
export const geminiImageRequestSchema = z.object({
  prompt: z.string()
    .min(5, 'Prompt must be at least 5 characters')
    .max(5000, 'Prompt must not exceed 5000 characters')
    .trim(),
  numberOfImages: z.coerce.number()
    .int('Number of images must be an integer')
    .min(1, 'At least 1 image is required')
    .max(4, 'Maximum 4 images allowed')
    .default(1),
  aspectRatio: aspectRatioSchema.default('1:1'),
  resolution: resolutionSchema.default('1K')
});

// Схема для Imagen API
export const imagenRequestSchema = z.object({
  prompt: z.string()
    .min(5, 'Prompt must be at least 5 characters')
    .max(5000, 'Prompt must not exceed 5000 characters')
    .trim(),
  numberOfImages: z.coerce.number()
    .int('Number of images must be an integer')
    .min(1, 'At least 1 image is required')
    .max(4, 'Maximum 4 images allowed')
    .default(1),
  imageSize: z.enum(['1K', '2K']).default('1K'),
  aspectRatio: aspectRatioSchema.default('1:1'),
  modelVersion: imagenModelVersionSchema.default('imagen-4.0-generate-001')
});

// Схема для Gemini Stream API (текст/HTML)
export const geminiStreamRequestSchema = z.object({
  prompt: z.string()
    .min(5, 'Prompt must be at least 5 characters')
    .max(50000, 'Prompt must not exceed 50000 characters')
    .trim(),
  modelVersion: geminiModelVersionSchema.default('gemini-2.5-pro')
});

// Схема для Gemini Research API
export const geminiResearchRequestSchema = z.object({
  prompt: z.string()
    .min(10, 'Research prompt must be at least 10 characters')
    .max(10000, 'Research prompt must not exceed 10000 characters')
    .trim(),
  modelVersion: geminiModelVersionSchema.default('gemini-2.5-pro')
});

// Схема для референсного изображения
export const referenceImageSchema = z.object({
  file: z.string()
    .regex(/^data:image\/(jpeg|jpg|png|webp);base64,/, 'Invalid image format. Must be base64 encoded image'),
  name: z.string().min(1, 'Image name is required'),
  size: z.coerce.number().positive('Image size must be positive')
});

// Схема для Veo API
export const veoRequestSchema = z.object({
  prompt: z.string()
    .min(10, 'Video prompt must be at least 10 characters')
    .max(2000, 'Video prompt must not exceed 2000 characters')
    .trim(),
  referenceImages: z.array(referenceImageSchema).max(1, 'Maximum 1 reference image allowed').default([]),
  modelVersion: veoModelVersionSchema.default('veo-2.0-generate-001'),
  durationSeconds: videoDurationSchema.default('8'),
  aspectRatio: aspectRatioSchema.default('16:9'),
  resolution: videoResolutionSchema.default('720p')
});

// Схема для аутентификации
export const verifyTokenRequestSchema = z.object({
  token: z.string()
    .min(1, 'Token is required')
    .max(500, 'Token is too long')
});

// Схема для истории (GET запрос)
export const historyGetQuerySchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  mode: modeSchema.optional(),
  model: z.string().optional(),
  page: z.coerce.number()
    .int('Page must be an integer')
    .min(1, 'Page must be at least 1')
    .default(1),
  limit: z.coerce.number()
    .int('Limit must be an integer')
    .min(1, 'Limit must be at least 1')
    .max(100, 'Limit must not exceed 100')
    .default(50)
});

// Схема для истории (POST запрос)
export const historyPostRequestSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  prompt: z.string()
    .min(1, 'Prompt is required')
    .max(50000, 'Prompt is too long'),
  mode: modeSchema,
  model: z.string().optional().nullable(),
  results: z.any().optional().nullable() // JSON может быть любым
});

// Типы для TypeScript
export type GeminiImageRequest = z.infer<typeof geminiImageRequestSchema>;
export type ImagenRequest = z.infer<typeof imagenRequestSchema>;
export type GeminiStreamRequest = z.infer<typeof geminiStreamRequestSchema>;
export type GeminiResearchRequest = z.infer<typeof geminiResearchRequestSchema>;
export type VeoRequest = z.infer<typeof veoRequestSchema>;
export type VerifyTokenRequest = z.infer<typeof verifyTokenRequestSchema>;
export type HistoryGetQuery = z.infer<typeof historyGetQuerySchema>;
export type HistoryPostRequest = z.infer<typeof historyPostRequestSchema>;