import NextAuth, { DefaultSession, AuthOptions } from "next-auth";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from '@/lib/prisma';
import CredentialsProvider from "next-auth/providers/credentials";
import crypto from 'crypto';

/**
 * Определяет структуру данных пользователя, получаемых от виджета Telegram.
 */
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
 * Расширение стандартных типов NextAuth для добавления кастомных полей.
 * Это называется "Module Augmentation".
 */
declare module "next-auth" {
  /**
   * Расширяем интерфейс Session, добавляя в объект user поле `id`.
   * Теперь `id` пользователя будет доступен в сессии на клиенте и сервере.
   */
  interface Session {
    user: {
      id: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  /**
   * Расширяем интерфейс JWT, добавляя в токен поле `id`.
   * Это поле будет использоваться для передачи ID пользователя между колбэками.
   */
  interface JWT {
    id: string;
  }
}

/**
 * Основной объект конфигурации для NextAuth.
 * Здесь определяются провайдеры аутентификации, стратегия сессий, колбэки и адаптер базы данных.
 */
const authOptions: AuthOptions = {
  // Адаптер для связи NextAuth с базой данных через Prisma.
  adapter: PrismaAdapter(prisma),
  providers: [
    // Используем CredentialsProvider для кастомной логики входа через виджет Telegram.
    CredentialsProvider({
      id: "telegram-widget",
      name: "Telegram Widget",
      credentials: {}, // Поля credentials не нужны, так как данные приходят целиком от виджета.

      /**
       * Функция, которая проверяет подлинность данных от Telegram и авторизует пользователя.
       * @param credentials - Объект с данными, полученными от Telegram-виджета.
       * @returns Объект пользователя в случае успеха или `null` в случае ошибки.
       */
      async authorize(credentials) {
        const allData = credentials as Record<string, string | number>;

        // 1. Проверяем наличие обязательных данных и токена бота.
        if (!allData || !allData.hash || !process.env.TELEGRAM_BOT_TOKEN) {
          console.error("Authorize error: Missing data or bot token.");
          return null;
        }

        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        const hash = allData.hash;

        // 2. Формируем строку для проверки хеша согласно документации Telegram.
        // Необходимо собрать все поля (кроме hash) в формате "key=value", отсортировать по ключу и объединить через '\n'.
        const telegramKeys = [
          'id', 'first_name', 'last_name', 'username', 'photo_url', 'auth_date'
        ];

        const checkString = telegramKeys
          .filter(key => allData[key] !== undefined && allData[key] !== null) // Отбираем только существующие поля
          .map(key => `${key}=${allData[key]}`) // Превращаем в "key=value"
          .sort() // Сортируем по ключу
          .join('\n'); // Объединяем

        console.log("--- CLEAN Data Check String ---");
        console.log(checkString);
        console.log("-------------------------------");

        // 3. Вычисляем секретный ключ и хеш HMAC-SHA256 для проверки подлинности.
        const secretKey = crypto.createHash('sha256')
          .update(botToken)
          .digest();

        const hmac = crypto.createHmac('sha256', secretKey)
          .update(checkString)
          .digest('hex');

        // 4. Сравниваем наш хеш с хешем, пришедшим от Telegram. Если они не совпадают, данные подделаны.
        if (hmac !== hash) {
          console.error("Authorize error: Invalid hash. Data might be forged.");
          console.log(`Expected hash: ${hmac}`);
          console.log(`Received hash: ${hash}`);
          return null;
        }

        const userData = allData as unknown as TelegramUser;

        // 5. Проверяем, что данные аутентификации не старше 24 часов, для защиты от replay-атак.
        if (userData.auth_date) {
          const authDate = new Date(userData.auth_date * 1000);
          const now = new Date();
          if (now.getTime() - authDate.getTime() > 86400000) { // 24 часа в миллисекундах
            console.error("Authorize error: Auth data is outdated.");
            return null;
          }
        }

        const telegramId = userData.id.toString();

        // 6. Находим пользователя в БД по его Telegram ID или создаем нового (upsert).
        try {
          const user = await prisma.user.upsert({
            where: { id: telegramId },
            // Если пользователь найден, обновляем его имя и фото.
            update: {
              name: [userData.first_name, userData.last_name].filter(Boolean).join(" "),
              image: userData.photo_url,
            },
            // Если пользователь не найден, создаем новую запись.
            create: {
              id: telegramId,
              name: [userData.first_name, userData.last_name].filter(Boolean).join(" "),
              image: userData.photo_url,
              email: null, // У пользователей Telegram нет email.
            },
          });
          console.log("SUCCESS! User authorized:", user.name);
          return user; // Возвращаем пользователя, завершая авторизацию.

        } catch (error) {
          console.error("Error during DB operation in authorize:", error);
          return null;
        }
      },
    }),
  ],

  // Стратегия сессии: JWT. Данные сессии хранятся в зашифрованном JWT-токене, а не в БД.
  session: {
    strategy: "jwt",
  },
  // Колбэки для кастомизации процесса аутентификации.
  callbacks: {
    /**
     * Этот колбэк вызывается при создании или обновлении JWT.
     * Мы добавляем в токен ID пользователя из базы данных.
     */
    async jwt({ token, user }) {
      if (user) { token.id = user.id; }
      return token;
    },
    /**
     * Этот колбэк вызывается при создании или обновлении сессии.
     * Мы берем ID пользователя из токена и добавляем его в объект сессии.
     */
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
  // Указываем, что для страницы входа используется главная страница.
  pages: {
    signIn: '/',
  },
};

// Создаем обработчики для GET и POST запросов, которые будет использовать Next.js.
const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
