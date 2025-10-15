import { useState, useCallback, useEffect } from 'react';
import { PANELS_COUNT } from '@/types/stream';

export const useIframeHeight = (mode: 'text' | 'html', streams: any[]) => {
  const [iframeHeights, setIframeHeights] = useState<number[]>(
    () => Array.from({ length: PANELS_COUNT }, () => 400)
  );

  const adjustIframeHeight = useCallback((iframe: HTMLIFrameElement, index: number) => {
    try {
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (doc) {
        setTimeout(() => {
          const body = doc.body;
          const html = doc.documentElement;

          // Убираем отступы для точного измерения
          if (body) {
            body.style.margin = '0';
            body.style.padding = '0';
          }
          if (html) {
            html.style.margin = '0';
            html.style.padding = '0';
          }

          // Получаем реальную высоту контента
          const height = Math.max(
            body.scrollHeight,
            body.offsetHeight,
            html.scrollHeight,
            html.offsetHeight
          );

          // Устанавливаем высоту iframe по контенту
          iframe.style.height = `${height}px`;

          // Сохраняем высоту для этого конкретного iframe
          setIframeHeights(prev => {
            const next = [...prev];
            next[index] = height;
            return next;
          });

          console.log(`Iframe ${index} height set to: ${height}px`);
        }, 200);
      }
    } catch (e) {
      console.warn('Cannot access iframe content:', e);
      iframe.style.height = '400px';
      setIframeHeights(prev => {
        const next = [...prev];
        next[index] = 400;
        return next;
      });
    }
  }, []);

  // useEffect для обработки изменения содержимого
  useEffect(() => {
    if (mode !== 'html') return;

    const containers = document.querySelectorAll('.result-container');

    containers.forEach((container, containerIndex) => {
      const iframe = container.querySelector('iframe[title*="HTML Preview"]');

      if (iframe) {
        const htmlIframe = iframe as HTMLIFrameElement;
        adjustIframeHeight(htmlIframe, containerIndex);

        const handleLoad = () => {
          adjustIframeHeight(htmlIframe, containerIndex);
        };

        htmlIframe.addEventListener('load', handleLoad);

        return () => {
          htmlIframe.removeEventListener('load', handleLoad);
        };
      }
    });
  }, [streams, adjustIframeHeight, mode]);

  return {
    iframeHeights,
    adjustIframeHeight
  };
};