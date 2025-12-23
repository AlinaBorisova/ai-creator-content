import { prisma } from '@/lib/prisma';
import { getCachedToken, setCachedToken } from '@/lib/tokenCache';

export interface TokenVerificationResult {
	valid: boolean;
	user?: {
		id: string;
		name: string;
		email?: string;
	};
	error?: 'INVALID_TOKEN' | 'EXPIRED_TOKEN' | 'DB_ERROR' | 'QUOTA_EXCEEDED';
}

/**
 * Проверяет валидность токена
 * Использует кэш для оптимизации производительности
 * @param token - Токен для проверки
 * @param useCache - Использовать ли кэш (по умолчанию true)
 * @returns Результат проверки токена
 */
export async function verifyToken(
	token: string,
	useCache: boolean = true
): Promise<TokenVerificationResult> {
	// Проверяем кэш сначала - это снижает нагрузку на БД
	if (useCache) {
		const cached = getCachedToken(token);
		if (cached) {
			if (cached.valid && cached.user) {
				return {
					valid: true,
					user: cached.user,
				};
			} else {
				return {
					valid: false,
					error: 'INVALID_TOKEN',
				};
			}
		}
	}

	try {
		// Если нет в кэше, запрашиваем из БД
		const userToken = await prisma.apiToken.findFirst({
			where: {
				token,
				isActive: true,
			},
			select: {
				id: true,
				expiresAt: true,
				user: {
					select: {
						id: true,
						name: true,
						email: true,
					},
				},
			},
		});

		if (!userToken) {
			// Кэшируем отрицательный результат
			if (useCache) {
				setCachedToken(token, false);
			}
			return {
				valid: false,
				error: 'INVALID_TOKEN',
			};
		}

		// Проверяем срок действия токена
		if (userToken.expiresAt && userToken.expiresAt < new Date()) {
			if (useCache) {
				setCachedToken(token, false);
			}
			return {
				valid: false,
				error: 'EXPIRED_TOKEN',
			};
		}

		// Сохраняем в кэш успешный результат
		if (useCache) {
			setCachedToken(token, true, {
				id: userToken.user.id,
				name: userToken.user.name,
				email: userToken.user.email || undefined,
			});
		}

		return {
			valid: true,
			user: {
				id: userToken.user.id,
				name: userToken.user.name,
				email: userToken.user.email || undefined,
			},
		};
	} catch (error) {
		console.error('Error verifying token:', error);

		// Обработка ошибок квоты БД
		if (error instanceof Error) {
			const errorMessage = error.message.toLowerCase();
			if (
				errorMessage.includes('data transfer quota') ||
				errorMessage.includes('exceeded') ||
				errorMessage.includes('quota')
			) {
				return {
					valid: false,
					error: 'QUOTA_EXCEEDED',
				};
			}
		}

		return {
			valid: false,
			error: 'DB_ERROR',
		};
	}
}