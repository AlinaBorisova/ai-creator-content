import { useCallback, useRef } from 'react';
import { Mode, StreamState, PANELS_COUNT, GroundingMetadata } from '@/types/stream';
import { GeminiModelVersion } from '@/app/components/GeminiModelSelector';

interface UseTextGenerationProps {
  mode: Mode;
  setStreams: (mode: Mode) => React.Dispatch<React.SetStateAction<StreamState[]>>;
  appendDelta: (index: number, delta: string, mode: Mode) => void;
  markDone: (index: number, mode: Mode) => void;
  updateGroundingMetadata: (index: number, mode: Mode, metadata: GroundingMetadata) => void;
  selectedGeminiModel: GeminiModelVersion;
}

export function useTextGeneration({
  mode,
  setStreams,
  appendDelta,
  markDone,
  updateGroundingMetadata,
  selectedGeminiModel,
}: UseTextGenerationProps) {
  const controllersRef = useRef<Array<AbortController | null>>(
    Array.from({ length: PANELS_COUNT }, () => null)
  );

  // Сохраняем промпты для retry
  const promptsRef = useRef<Array<{ prompt: string; isResearch: boolean }>>(
    Array.from({ length: PANELS_COUNT }, () => ({ prompt: '', isResearch: false }))
  );

  const formatHtmlPrompt = useCallback((prompt: string) => {
    return `${prompt}

STRICT FORMAT REQUIRED - Output ONLY this structure:

\`\`\`html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Page Title</title>
  <style>
    /* ALL your CSS styles go here */
  </style>
</head>
<body>
  <!-- Your HTML content here -->
</body>
</html>
\`\`\`

RULES:
- Output ONLY the HTML code block above
- ALL styles must be inside the <style> tag in <head>
- NO separate CSS blocks
- NO explanations or text outside the code block
- Make it visually appealing with modern design
- Use BEM methodology for class names`;
  }, []);

  const formatResearchPrompt = useCallback((prompt: string) => {
    return `You are a research assistant. Use Google Search to find the most current and accurate information about the following topic/question, then create comprehensive content based on your research findings.

RESEARCH TOPIC/QUESTION:
${prompt}

IMPORTANT INSTRUCTIONS:
1. Use Google Search to find relevant, up-to-date information about the topic
2. Search for multiple aspects and perspectives on the topic
3. Synthesize the information from your search results
4. Create comprehensive, well-structured content based on your research

STRICT FORMAT REQUIRED - Output ONLY this structure:

\`\`\`html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Page Title</title>
  <style>
    /* ALL your CSS styles go here */
  </style>
</head>
<body>
  <!-- Your HTML content here -->
</body>
</html>
\`\`\`

RULES:
- Output ONLY the HTML code block above
- ALL styles must be inside the <style> tag in <head>
- NO separate CSS blocks
- NO explanations or text outside the code block
- Make it visually appealing with modern design
- Use BEM methodology for class names
- Use information from your research to create accurate and up-to-date content
- Include citations and references where appropriate`;
  }, []);

  const startStream = useCallback((index: number, promptText: string, isResearch: boolean = false) => {
    // Сохраняем ОРИГИНАЛЬНЫЙ промпт для возможного retry (до форматирования)
    promptsRef.current[index] = { prompt: promptText, isResearch };
    console.log(`💾 Saved prompt for index ${index}:`, promptText.slice(0, 50), 'isResearch:', isResearch);

    const controller = new AbortController();
    controllersRef.current[index] = controller;

    const apiEndpoint = isResearch ? '/api/ai/gemini/research' : '/api/ai/gemini/stream';
    const finalPrompt = isResearch
      ? formatResearchPrompt(promptText)
      : mode === 'html'
        ? formatHtmlPrompt(promptText)
        : promptText;

    const setStreamsFn = setStreams(mode);
    const currentMode = isResearch ? 'research' : mode;

    fetch(apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt: finalPrompt, modelVersion: selectedGeminiModel }),
      signal: controller.signal
    })
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.body?.getReader();
      })
      .then(reader => {
        if (!reader) {
          throw new Error('No reader available');
        }

        const decoder = new TextDecoder();
        let buffer = '';

        const readStream = (): Promise<void> => {
          return reader.read().then(({ done, value }) => {
            if (done) {
              markDone(index, currentMode);
              controllersRef.current[index] = null;
              return;
            }

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (line.trim()) {
                try {
                  const data = JSON.parse(line);

                  if (data.delta) {
                    if (isResearch) {
                      console.log(`📝 Received delta for research ${index}:`, data.delta.slice(0, 50) + '...');
                    }
                    appendDelta(index, data.delta, currentMode);
                  } else if (data.groundingMetadata && isResearch) {
                    console.log(`🔍 Received grounding metadata for research ${index}:`, JSON.stringify(data.groundingMetadata, null, 2));
                    updateGroundingMetadata(index, currentMode, data.groundingMetadata);
                  } else if (data.done) {
                    if (isResearch) {
                      console.log(`✅ Research ${index} completed`);
                    }
                    markDone(index, currentMode);
                    controllersRef.current[index] = null;
                  } else if (data.error) {
                    throw new Error(data.error);
                  }
                } catch (parseError) {
                  console.error(`Error parsing stream data for ${isResearch ? 'research' : 'stream'} ${index}:`, parseError);
                }
              }
            }

            return readStream();
          });
        };

        return readStream();
      })
      .catch(error => {
        // Проверяем, является ли это таймаутом (из gemini.ts)
        const isTimeout = error instanceof Error &&
          (error.message.includes('timed out') || error.message === 'Request was aborted or timed out');

        if (isTimeout) {
          // Таймаут - это ошибка, показываем кнопку retry
          console.error(`${isResearch ? 'Research' : 'Stream'} ${index} timed out after 120 seconds`);
          controllersRef.current[index] = null;
          setStreamsFn(prev => {
            const next = [...prev];
            if (next[index]) {
              next[index] = {
                ...next[index],
                status: 'error',
                error: 'Request timed out after 120 seconds. Please try again.'
              };
            }
            return next;
          });
          return;
        }

        // Проверяем, является ли это отменой пользователем
        if (error instanceof Error && (error.name === 'AbortError' || error.message === 'Aborted' || error.message.includes('aborted'))) {
          console.log(`${isResearch ? 'Research' : 'Stream'} ${index} aborted by user`);
          controllersRef.current[index] = null;
          setStreamsFn(prev => {
            const next = [...prev];
            if (next[index]?.status === 'loading') {
              next[index] = { ...next[index], status: 'idle' };
            }
            return next;
          });
          return;
        }

        // Все остальные ошибки
        console.error(`${isResearch ? 'Research' : 'Stream'} generation error for index ${index}:`, error);
        setStreamsFn(prev => {
          const next = [...prev];
          if (next[index]) {
            next[index] = {
              ...next[index],
              status: 'error',
              error: error instanceof Error ? error.message : 'Unknown error'
            };
          }
          return next;
        });
        controllersRef.current[index] = null;
      });
  }, [mode, setStreams, appendDelta, markDone, updateGroundingMetadata, selectedGeminiModel, formatHtmlPrompt, formatResearchPrompt]);

  const generateText = useCallback((promptText: string, requestCount: number, isResearch: boolean = false) => {
    const setStreamsFn = setStreams(mode);

    // Очищаем все потоки
    setStreamsFn(Array.from({ length: PANELS_COUNT }, () => ({ text: '', status: 'idle' })));

    // Инициализируем потоки для всех запросов
    setStreamsFn(prev => {
      const next = [...prev];
      for (let i = 0; i < requestCount; i++) {
        next[i] = { text: '', status: 'loading' };
      }
      return next;
    });

    // Сохраняем промпт для всех индексов заранее
    for (let i = 0; i < requestCount; i++) {
      promptsRef.current[i] = { prompt: promptText, isResearch };
    }
    console.log(`💾 Saved prompts for ${requestCount} streams:`, promptText.slice(0, 50));

    // Запускаем несколько параллельных запросов
    for (let i = 0; i < requestCount; i++) {
      startStream(i, promptText, isResearch);
    }
  }, [mode, setStreams, startStream]);

  const abortStream = useCallback((index: number) => {
    const ctrl = controllersRef.current[index];
    if (ctrl && !ctrl.signal.aborted) {
      try {
        ctrl.abort();
      } catch (error) {
        console.log('Controller abort handled', error);
      }
      controllersRef.current[index] = null;
    } else if (ctrl) {
      controllersRef.current[index] = null;
    }
    setStreams(mode)(prev => {
      const next = [...prev];
      if (next[index]?.status === 'loading') {
        next[index] = { ...next[index], status: 'idle' };
      }
      return next;
    });
  }, [setStreams, mode]);

  const retryStream = useCallback((index: number) => {
    const savedPrompt = promptsRef.current[index];
    if (!savedPrompt || !savedPrompt.prompt) {
      console.warn('No saved prompt for retry at index', index);
      console.warn('Available prompts:', promptsRef.current.map((p, i) => ({
        index: i,
        hasPrompt: !!p.prompt,
        prompt: p.prompt ? p.prompt.slice(0, 50) : 'empty'
      })));
      return;
    }

    console.log(`🔄 Retrying stream ${index} with saved prompt:`, savedPrompt.prompt.slice(0, 50));

    const setStreamsFn = setStreams(mode);

    // Устанавливаем статус loading и очищаем ошибку
    setStreamsFn(prev => {
      const next = [...prev];
      if (next[index]) {
        next[index] = {
          text: '',
          status: 'loading',
          error: undefined
        };
      }
      return next;
    });

    // Запускаем новый запрос с сохраненным промптом
    startStream(index, savedPrompt.prompt, savedPrompt.isResearch);
  }, [mode, setStreams, startStream]);

  return {
    generateText,
    abortStream,
    retryStream,
    controllersRef,
  };
}