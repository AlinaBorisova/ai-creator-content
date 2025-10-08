import NextAuth, { DefaultSession, AuthOptions } from "next-auth";
// Говорим линтеру игнорировать следующую строку, так как 'JWT' используется для расширения типа, а не как переменная.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { JWT } from "next-auth/jwt";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from '@/lib/prisma';
import CredentialsProvider from "next-auth/providers/credentials";

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

/**
 * Расширяем стандартные типы NextAuth, чтобы добавить `id` пользователя
 * в объект сессии и JWT токен.
 */
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
  }
}

export const authOptions: AuthOptions = {
  // Адаптер Prisma для связи с базой данных.
  // Он будет автоматически обрабатывать создание пользователей и сессий
  // на основе данных, которые мы ему передадим.
  adapter: PrismaAdapter(prisma),

  providers: [
    /**
     * Мы используем CredentialsProvider как основной метод входа.
     * Это "ручной" режим, где мы сами получаем данные (от виджета Telegram),
     * проверяем их и говорим NextAuth, что пользователь аутентифицирован.
     * Это полностью обходит проблему с `origin required` при редиректе.
     */
    CredentialsProvider({
      // Уникальный идентификатор для этого способа входа
      id: "telegram-widget",
      name: "Telegram Widget",
      // Поле credentials формально требуется, но мы не используем его для рендера формы
      credentials: {},

      /**
       * Функция authorize - это сердце нашего "ручного" входа.
       * Она получает данные, которые мы передали из фронтенда в `signIn()`.
       */
      async authorize(credentials) {
        const userData = credentials as TelegramUser;

        // Убедимся, что данные от виджета вообще пришли
        if (!userData || !userData.id) {
          console.error("Authorize error: No credentials received from widget.");
          return null; // Отклоняем аутентификацию
        }

        const telegramId = userData.id.toString(); // ID из Telegram приходит как число, в БД храним как строку

        try {
          // 1. Ищем пользователя в базе по его Telegram ID.
          const user = await prisma.user.findUnique({
            where: { id: telegramId },
          });

          // 2. Если пользователь найден - возвращаем его.
          // NextAuth создаст для него сессию.
          if (user) {
            return user;
          }

          // 3. Если пользователь не найден - создаем нового.
          const newUser = await prisma.user.create({
            data: {
              id: telegramId,
              name: [userData.first_name, userData.last_name].filter(Boolean).join(" "),
              image: userData.photo_url,
              // email остается null, так как Telegram его не предоставляет
              email: null,
            },
          });

          return newUser; // Возвращаем свежесозданного пользователя

        } catch (error) {
          console.error("Error during authorization:", error);
          return null; // В случае ошибки в БД, отклоняем вход
        }
      },
    }),
  ],

  // Используем JWT для сессий. Это дает нам больше контроля через callbacks.
  session: {
    strategy: "jwt",
  },

  // Callbacks позволяют нам модифицировать токен и сессию.
  callbacks: {
    /**
     * Этот callback вызывается при создании или обновлении JWT.
     * Мы добавляем в токен ID пользователя из базы данных.
     */
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },

    /**
     * Этот callback вызывается при создании или обновлении объекта сессии.
     * Мы берем ID из токена и добавляем его в объект сессии,
     * чтобы он был доступен на фронтенде (`useSession`).
     */
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },

  // Указываем, что наша главная страница также является страницей входа,
  // чтобы избежать редиректов на стандартную страницу входа NextAuth.
  pages: {
    signIn: '/',
  },
};

// Экспортируем хендлеры для GET и POST запросов, как того требует Next.js App Router
const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
