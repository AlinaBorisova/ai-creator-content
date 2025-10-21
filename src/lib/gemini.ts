const GOOGLE_AI_API_KEY = process.env.GOOGLE_AI_API_KEY;

if (!GOOGLE_AI_API_KEY) {
  throw new Error('GOOGLE_AI_API_KEY is missing');
}

export async function streamTextViaGeminiDirect(
  prompt: string,
  onDelta: (chunk: string) => void,
  signal?: AbortSignal
): Promise<string> {
  const cleaned = prompt.trim();
  
  if (!prompt || cleaned.length < 5) {
    throw new Error('Prompt is too short');
  }
  if (cleaned.length > 50000) {
    throw new Error('Prompt is too long');
  }

  try {
    console.log('🚀 Starting Gemini generation for prompt:', cleaned.slice(0, 50));
    
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${GOOGLE_AI_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: cleaned
                }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 32768,
          }
        }),
        signal
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API Error Response:', errorText);
      throw new Error(`HTTP error! status: ${response.status}, details: ${errorText}`);
    }

    const data = await response.json();
    console.log('📊 API Response structure:', JSON.stringify(data, null, 2));
    
    // Правильное извлечение текста из ответа
    let fullText = '';
    
    if (data.candidates && data.candidates.length > 0) {
      const candidate = data.candidates[0];
      if (candidate.content && candidate.content.parts && candidate.content.parts.length > 0) {
        fullText = candidate.content.parts[0].text || '';
      }
    }
    
    console.log('📝 Extracted text length:', fullText.length);
    console.log('📝 First 100 chars:', fullText.slice(0, 100));
    
    if (!fullText) {
      console.error('❌ No text in response:', data);
      throw new Error('No text generated');
    }

    // Эмулируем стриминг
    const chunkSize = 50;
    for (let i = 0; i < fullText.length; i += chunkSize) {
      if (signal?.aborted) {
        throw new Error('Aborted');
      }
      
      const chunk = fullText.slice(i, i + chunkSize);
      onDelta(chunk);
      
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    console.log('✅ Generation completed, total length:', fullText.length);
    return fullText;
  } catch (error) {
    console.error('❌ Gemini API Error:', error);
    if (signal?.aborted) {
      throw new Error('Aborted');
    }
    
    throw new Error(`Gemini API Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
