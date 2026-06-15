import { VertexAI, GenerateContentRequest, Tool } from '@google-cloud/vertexai';
import { GroundingMetadata } from '@/types/stream';

export type GeminiModelVersion = 'gemini-2.5-pro' | 'gemini-2.5-flash';

// Прячем инстанс в переменную, чтобы не создавать его каждый раз заново
let vertexAiInstance: VertexAI | null = null;

// Эта функция вызовется только при реальном запросе, а не во время сборки Vercel
function getVertexAI(): VertexAI {
  if (!vertexAiInstance) {
    const project = process.env.GOOGLE_CLOUD_PROJECT_ID;
    const location = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';
    const client_email = process.env.GOOGLE_CLOUD_CLIENT_EMAIL;
    const private_key = process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (!project || !client_email || !private_key) {
      console.warn('⚠️ Отсутствуют ключи Google Cloud Vertex AI в файле .env!');
    }

    vertexAiInstance = new VertexAI({
      project: project as string,
      location: location,
      googleAuthOptions: {
        credentials: {
          client_email,
          private_key,
        }
      }
    });
  }
  return vertexAiInstance;
}

export async function streamTextViaGeminiDirect(
  prompt: string,
  onDelta: (chunk: string) => void,
  signal?: AbortSignal,
  modelVersion: GeminiModelVersion = 'gemini-2.5-pro',
): Promise<string> {
  const cleaned = prompt.trim();

  if (!prompt || cleaned.length < 5) throw new Error('Prompt is too short');
  if (cleaned.length > 50000) throw new Error('Prompt is too long');

  try {
    console.log('🚀 Starting Vertex AI generation for prompt:', cleaned.slice(0, 50));
    console.log('📌 Using model:', modelVersion);

    // ПОЛУЧАЕМ КЛИЕНТА ЗДЕСЬ
    const vertexAI = getVertexAI();

    const generativeModel = vertexAI.getGenerativeModel({
      model: modelVersion,
      generationConfig: {
        temperature: modelVersion === 'gemini-2.5-flash' ? undefined : 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 32768
      }
    });

    const request: GenerateContentRequest = {
      contents: [{ role: 'user', parts: [{ text: cleaned }] }]
    };

    const streamingResp = await generativeModel.generateContentStream(request);
    let fullText = '';

    for await (const item of streamingResp.stream) {
      if (signal?.aborted) {
        throw new Error('Aborted');
      }

      if (item.candidates && item.candidates.length > 0) {
        const candidate = item.candidates[0];

        if (candidate.finishReason && !['STOP', 'FINISH_REASON_UNSPECIFIED'].includes(candidate.finishReason)) {
          if (['SAFETY', 'RECITATION', 'BLOCKLIST'].includes(candidate.finishReason)) {
            throw new Error(`Content blocked: ${candidate.finishReason}`);
          }
        }

        const chunkText = candidate.content?.parts?.[0]?.text || '';
        if (chunkText) {
          fullText += chunkText;
          onDelta(chunkText);
        }
      }
    }

    console.log('✅ Generation completed, total length:', fullText.length);
    return fullText;
  } catch (error) {
    console.error('❌ Vertex AI Error:', error);
    if (signal?.aborted || (error instanceof Error && error.message.includes('Aborted'))) {
      throw new Error('Request was aborted');
    }
    throw new Error(`Vertex AI Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function streamTextViaGeminiWithSearch(
  prompt: string,
  onDelta: (chunk: string) => void,
  signal?: AbortSignal,
  modelVersion: GeminiModelVersion = 'gemini-2.5-pro',
): Promise<{ text: string; groundingMetadata?: GroundingMetadata }> {
  const cleaned = prompt.trim();

  if (!prompt || cleaned.length < 5) throw new Error('Prompt is too short');
  if (cleaned.length > 50000) throw new Error('Prompt is too long');

  try {
    console.log('🔍 Starting Vertex AI generation with Google Search for prompt:', cleaned.slice(0, 50));
    console.log('📌 Using model:', modelVersion);

    // ПОЛУЧАЕМ КЛИЕНТА ЗДЕСЬ
    const vertexAI = getVertexAI();

    const generativeModel = vertexAI.getGenerativeModel({
      model: modelVersion,
      generationConfig: {
        temperature: modelVersion === 'gemini-2.5-flash' ? undefined : 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 32768
      },
      tools: [
        { googleSearch: {} } as Tool
      ]
    });

    const request: GenerateContentRequest = {
      contents: [{ role: 'user', parts: [{ text: cleaned }] }]
    };

    const streamingResp = await generativeModel.generateContentStream(request);
    let fullText = '';

    for await (const item of streamingResp.stream) {
      if (signal?.aborted) {
        throw new Error('Aborted');
      }

      if (item.candidates && item.candidates.length > 0) {
        const candidate = item.candidates[0];

        if (candidate.finishReason && !['STOP', 'FINISH_REASON_UNSPECIFIED'].includes(candidate.finishReason)) {
          if (['SAFETY', 'RECITATION', 'BLOCKLIST'].includes(candidate.finishReason)) {
            throw new Error(`Content blocked: ${candidate.finishReason}`);
          }
        }

        const chunkText = candidate.content?.parts?.[0]?.text || '';
        if (chunkText) {
          fullText += chunkText;
          onDelta(chunkText);
        }
      }
    }

    const aggregatedResponse = await streamingResp.response;
    let groundingMetadata: GroundingMetadata | undefined = undefined;

    // Безопасное извлечение метаданных для TypeScript
    const firstCandidate = aggregatedResponse.candidates?.[0];
    if (firstCandidate && 'groundingMetadata' in firstCandidate) {
      const candidateWithMetadata = firstCandidate as unknown as { groundingMetadata: GroundingMetadata };
      groundingMetadata = candidateWithMetadata.groundingMetadata;
      console.log('🔍 Grounding metadata extracted successfully');
    }

    console.log('✅ Generation with search completed, total length:', fullText.length);
    return { text: fullText, groundingMetadata };
  } catch (error) {
    console.error('❌ Vertex AI Error:', error);
    if (signal?.aborted || (error instanceof Error && error.message.includes('Aborted'))) {
      throw new Error('Request was aborted');
    }
    throw new Error(`Vertex AI Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}