import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { operation } = await request.json();

    if (!operation) {
      return NextResponse.json({ error: 'Operation ID is required' }, { status: 400 });
    }
    //console.log('🔍 ЗАГЛУШКА: Проверка статуса операции:', operation);

    // Заглушка - всегда возвращаем "готово" для mock операций
    // if (operation.startsWith('operations/mock-')) {
    //   return NextResponse.json({
    //     done: true,
    //     response: {
    //       generateVideoResponse: {
    //         generatedSamples: [{
    //           video: {
    //             uri: 'mock-video-url',
    //             mimeType: 'video/mp4'
    //           }
    //         }]
    //       }
    //     }
    //   });
    // }
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/${operation}?key=${apiKey}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Status check failed: ${response.statusText}`);
    }

    const data = await response.json();

    return NextResponse.json({
      done: data.done,
      response: data.response,
      error: data.error
    });

  } catch (error) {
    console.error('💥 Veo status check error:', error);
    return NextResponse.json({ error: 'Failed to check status' }, { status: 500 });
  }
}