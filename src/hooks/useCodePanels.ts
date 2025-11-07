import { useState, useCallback, useEffect } from 'react';
import { PANELS_COUNT, Mode } from '@/types/stream';

export const useCodePanels = (mode: Mode, iframeHeights: number[]) => {
  const [openCodePanels, setOpenCodePanels] = useState<boolean[]>(
    () => Array.from({ length: PANELS_COUNT }, () => false)
  );

  const syncColumnHeights = useCallback(() => {
    console.log('🔄 syncColumnHeights called');
    console.log('Current iframe heights:', iframeHeights);
    console.log('Open code panels:', openCodePanels);

    const containers = document.querySelectorAll('.result-container');

    containers.forEach((container, containerIndex) => {
      const codeColumn = container.querySelector('.code-column');
      const iframe = container.querySelector('iframe');

      if (codeColumn && iframe) {
        // Проверяем, открыт ли блок кода для этого контейнера
        if (openCodePanels[containerIndex]) {
          // Если открыт - устанавливаем высоту по iframe
          const iframeHeight = iframeHeights[containerIndex] || 400;

          // Устанавливаем высоту для левого блока (code) равной высоте iframe
          (codeColumn as HTMLElement).style.height = `${iframeHeight}px`;

          // И для code-content с учетом отступов
          const codeContent = codeColumn.querySelector('.code-content');
          if (codeContent) {
            const contentHeight = Math.max(iframeHeight - 60, 300);
            (codeContent as HTMLElement).style.height = `${contentHeight}px`;
          }

          console.log(`Container ${containerIndex}: Setting code height to ${iframeHeight}px (panel is open)`);
        } else {
          // Если закрыт - устанавливаем высоту 0
          (codeColumn as HTMLElement).style.height = '0px';

          const codeContent = codeColumn.querySelector('.code-content');
          if (codeContent) {
            (codeContent as HTMLElement).style.height = '0px';
          }

          console.log(`Container ${containerIndex}: Setting code height to 0px (panel is closed)`);
        }
      }
    });
  }, [iframeHeights, openCodePanels]);

  const toggleCodePanel = useCallback((index: number) => {
    setOpenCodePanels(prev => {
      const next = [...prev];
      next[index] = !next[index];
      return next;
    });

    // Принудительная синхронизация после изменения состояния (для HTML и Research режимов)
    if (mode === 'html' || mode === 'research') {
      setTimeout(() => {
        syncColumnHeights();
      }, 100);
    }
  }, [syncColumnHeights, mode]);

  // useEffect для синхронизации при изменении состояния панелей
  useEffect(() => {
    if (mode === 'html' || mode === 'research') {
      const timer = setTimeout(() => {
        syncColumnHeights();
      }, 350);

      return () => clearTimeout(timer);
    }
  }, [openCodePanels, syncColumnHeights, mode]);

  // useEffect для синхронизации при изменении высот iframe
  useEffect(() => {
    if (mode === 'html' || mode === 'research') {
      syncColumnHeights();
    }
  }, [iframeHeights, syncColumnHeights, mode]);

  return {
    openCodePanels,
    toggleCodePanel
  };
};