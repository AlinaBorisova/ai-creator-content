import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { videoUri } = await request.json();

    if (!videoUri) {
      return NextResponse.json({ error: 'Video URI is required' }, { status: 400 });
    }

    //console.log('📥 ЗАГЛУШКА: Скачивание видео с URI:', videoUri);

    // Заглушка - возвращаем mock данные
    // if (videoUri === 'mock-video-url') {
    //   return NextResponse.json({
    //     success: true,
    //     videoBytes: 'mock-video-data-base64',
    //     mimeType: 'video/mp4',
    //     message: 'Это заглушка для тестирования'
    //   });
    // }

    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
    }

    const videoResponse = await fetch(videoUri, {
      headers: {
        'x-goog-api-key': apiKey
      }
    });

    if (!videoResponse.ok) {
      return NextResponse.json({ error: 'Failed to download video' }, { status: videoResponse.status });
    }

    const videoBuffer = await videoResponse.arrayBuffer();
    const videoBytes = Buffer.from(videoBuffer).toString('base64');

    // Возвращаем видео без определения длительности на сервере
    return NextResponse.json({
      success: true,
      videoBytes,
      mimeType: 'video/mp4'
      // Длительность будет определена на клиенте
    });

  } catch (error) {
    console.error('Video download error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}