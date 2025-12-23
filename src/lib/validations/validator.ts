import { ZodSchema, ZodError } from 'zod';
import { NextResponse } from 'next/server';

/**
 * Валидирует данные по схеме Zod
 * @param schema - Схема Zod для валидации
 * @param data - Данные для валидации
 * @returns Объект с результатом валидации
 */
export function validateData<T>(
  schema: ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: ZodError } {
  const result = schema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  } else {
    return { success: false, error: result.error };
  }
}

/**
 * Форматирует ошибки Zod в понятный формат для клиента
 * @param error - Ошибка Zod
 * @returns Массив сообщений об ошибках
 */
export function formatZodError(error: ZodError): string[] {
  return error.issues.map((err) => {
    const path = err.path.join('.');
    return path ? `${path}: ${err.message}` : err.message;
  });
}

/**
 * Создает ответ NextResponse с ошибками валидации
 * @param error - Ошибка Zod
 * @param statusCode - HTTP статус код (по умолчанию 400)
 * @returns NextResponse с ошибками
 */
export function createValidationErrorResponse(
  error: ZodError,
  statusCode: number = 400
): NextResponse {
  const formattedErrors = formatZodError(error);

  return NextResponse.json(
    {
      error: 'Validation failed',
      details: formattedErrors,
      issues: error.issues.map((err) => ({
        path: err.path.join('.'),
        message: err.message,
        code: err.code
      }))
    },
    { status: statusCode }
  );
}

/**
 * Валидирует тело запроса и возвращает валидированные данные или ошибку
 * @param schema - Схема Zod
 * @param body - Тело запроса (обычно из request.json())
 * @returns Валидированные данные или NextResponse с ошибкой
 */
export async function validateRequest<T>(
  schema: ZodSchema<T>,
  body: unknown
): Promise<{ success: true; data: T } | { success: false; response: NextResponse }> {
  const validation = validateData(schema, body);

  if (!validation.success) {
    return {
      success: false,
      response: createValidationErrorResponse(validation.error)
    };
  }

  return {
    success: true,
    data: validation.data
  };
}