import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
	const token = request.cookies.get('authToken')?.value ||
		request.headers.get('authorization')?.replace('Bearer ', '');

	// Защищаем страницы /ai и /parser
	if (request.nextUrl.pathname.startsWith('/ai') ||
		request.nextUrl.pathname.startsWith('/parser')) {

		if (!token) {
			return NextResponse.redirect(new URL('/', request.url));
		}
	}

	return NextResponse.next();
}

export const config = {
	matcher: ['/ai/:path*', '/parser/:path*']
};