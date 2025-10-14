const GEMINI_API_KEY = process.env.GEN_API_KEY;
const START_GENERATION_URL = 'https://api.gen-api.ru/api/v1/networks/gemini-2-5-pro';
const CHECK_STATUS_URL_BASE = 'https://api.gen-api.ru/api/v1/request/get/';

type StartResp = { request_id: string };
type CheckResp = {
  status: 'pending' | 'processing' | 'success' | 'error';
  result?: string; // текущий накопленный текст (если API так возвращает)
  error?: string;
};

async function startTextJob(prompt: string): Promise<string> {
  /* POST → request_id */
  if(!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is missing');
  const cleaned = prompt.trim();
  if (!prompt || cleaned.length < 5) throw new Error('Prompt is too short');
  if (cleaned.length > 10000) throw new Error('Prompt is too long');

  // Этап 1: Запуск задачи на генерацию
  const startResponse = await fetch(START_GENERATION_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GEMINI_API_KEY}` },
    body: JSON.stringify({ "messages": [
        {
            "role": "user",
            "content": cleaned,
        }
    ],
  }),
    signal: AbortSignal.timeout(60000), // Таймаут на сам запрос, если API долго не отвечает
  });

  if (!startResponse.ok) {
    throw new Error(`[Gemini] Start API Error: ${await startResponse.text()}`);
  }

  const startData = (await startResponse.json()) as StartResp;
  const requestId = startData?.request_id;
  if (!requestId) throw new Error(`Could not get request_id: ${JSON.stringify(startData)}`);
  
  return requestId;
}

async function checkTextStatus(requestId: string, signal?: AbortSignal): Promise<CheckResp> { 
  /* GET → status/result */ 
  if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is missing');
  if (!requestId) throw new Error('requestId is required');

  const res = await fetch(`${CHECK_STATUS_URL_BASE}${requestId}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${GEMINI_API_KEY}` },
    signal,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    return { status: 'error', error: `Status check failed: ${text || res.statusText}` };
  }

  const data = await res.json() as Record<string, unknown>;
  const status = (data.status ?? 'pending') as CheckResp['status'];
  const resultRaw: unknown = data.result;

  let result: string | undefined;
  if (typeof resultRaw === 'string') {
    result = resultRaw;
  } else if (Array.isArray(resultRaw) && resultRaw.length > 0) {
    result = String(resultRaw[0]);
  } else if (resultRaw == null) {
    result = undefined;
  } else {
    result = JSON.stringify(resultRaw);
  }

  const error =
    typeof data.error === 'string'
      ? data.error
      : data.error == null
      ? undefined
      : JSON.stringify(data.error);

  return { status, result, error };
}

export async function streamTextViaGenApi(
  prompt: string,
  onDelta: (chunk: string) => void,
  opts?: { pollMs?: number; totalMs?: number },
  signal?: AbortSignal
): Promise<string> { 
  /* polling + onDelta + return final text */ 
  const pollMs = opts?.pollMs ?? 500;
  const totalMs = opts?.totalMs ?? 120000;
  const cleaned = prompt.trim();

  if(!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is missing');
  if (!prompt || cleaned.length < 5) throw new Error('Prompt is too short');
  if (cleaned.length > 10000) throw new Error('Prompt is too long');

  const requestId = await startTextJob(prompt);
  let lastLen = 0;
  let finalText = '';
  const started = Date.now();

  while (Date.now() - started < totalMs) {
    if (signal?.aborted) throw new Error('Aborted');
    const status = await checkTextStatus(requestId, signal);
    if (status.error) throw new Error(status.error);

    const full = status.result ?? '';
    if (full.length > lastLen) {
      const delta = full.slice(lastLen);
      onDelta(delta);
      lastLen = full.length;
      finalText = full;
    }

    if (status.status === 'success') break;
    await new Promise(r => setTimeout(r, pollMs));
  }

  if (Date.now() - started >= totalMs) throw new Error('Generation timeout');
  return finalText;
}