import React from 'react';
import { StreamState, Mode } from '@/types/stream';
import { extractHtmlFromMarkdown } from '@/utils/markdown';

interface StreamResultProps {
  stream: StreamState;
  index: number;
  mode: Mode;
  isEditing: boolean;
  isCodePanelOpen: boolean;
  iframeHeight: number;
  onToggleEdit: (index: number) => void;
  onUpdateText: (index: number, text: string) => void;
  onCopyToClipboard: (index: number) => void;
  onAbort: (index: number) => void;
  onToggleCodePanel: (index: number) => void;
  onAdjustIframeHeight: (iframe: HTMLIFrameElement, index: number) => void;
}

export const StreamResult: React.FC<StreamResultProps> = ({
  stream,
  index,
  mode,
  isEditing,
  isCodePanelOpen,
  iframeHeight,
  onToggleEdit,
  onUpdateText,
  onCopyToClipboard,
  onAbort,
  onToggleCodePanel,
  onAdjustIframeHeight
}) => {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-800/50 p-4 flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-200">Result #{index + 1}</h3>
        <span className={
          stream.status === 'loading'
            ? 'text-xs px-2 py-1 rounded bg-blue-900/40 text-blue-300'
            : stream.status === 'done'
              ? 'text-xs px-2 py-1 rounded bg-green-900/30 text-green-300'
              : stream.status === 'error'
                ? 'text-xs px-2 py-1 rounded bg-red-900/30 text-red-300'
                : 'text-xs px-2 py-1 rounded bg-gray-700 text-gray-300'
        }>
          {stream.status}
        </span>
      </div>

      {mode === 'html' ? (
        // HTML режим: кнопка слева + preview + выдвижной блок с кодом
        <div className="w-full result-container">
          <div className="relative flex">
            {/* Кнопка для показа/скрытия кода слева */}
            <button
              onClick={() => onToggleCodePanel(index)}
              className={`flex-shrink-0 w-12 h-12 mr-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 flex flex-col items-center justify-center cursor-pointer transition-all duration-300 ${isCodePanelOpen ? 'bg-blue-600 hover:bg-blue-700 hidden' : ''
                }`}
              title={isCodePanelOpen ? 'Скрыть код' : 'Показать код'}
            >
              <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
              <span className="text-xs">Code</span>
            </button>

            {/* Контейнер для preview и кода */}
            <div className="flex-1 flex">
              {/* Блок с кодом */}
              <div className={`bg-gray-900 border-r border-gray-700 transition-all duration-300 ease-in-out overflow-y-auto code-column ${isCodePanelOpen
                ? 'w-1/2 opacity-100 translate-x-0'
                : 'w-0 opacity-0 -translate-x-full overflow-hidden'
                }`}>
                <div
                  className="flex flex-col min-w-0"
                  style={{
                    height: isCodePanelOpen ? `${iframeHeight}px` : '0px',
                    overflow: isCodePanelOpen ? 'visible' : 'hidden'
                  }}
                >
                  <div className="flex items-center justify-between p-2 flex-shrink-0">
                    <h4 className="text-sm font-semibold text-gray-200">HTML Code</h4>
                    <button
                      onClick={() => onToggleCodePanel(index)}
                      className="text-gray-400 hover:text-gray-200 transition-colors cursor-pointer"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  <div
                    className="flex-1 overflow-y-auto custom-scrollbar code-content"
                    style={{
                      minHeight: isCodePanelOpen ? '300px' : '0px',
                      height: isCodePanelOpen ? `${Math.max(iframeHeight - 60, 300)}px` : '0px'
                    }}
                  >
                    <div className="bg-gray-800 rounded p-3 border border-gray-700 h-full">
                      {stream.status === 'error' ? (
                        <p className="text-red-300 text-sm">{stream.error ?? 'Error'}</p>
                      ) : isEditing ? (
                        <textarea
                          value={stream.text}
                          onChange={(e) => onUpdateText(index, e.target.value)}
                          className="w-full h-full min-h-[300px] bg-gray-700 text-gray-300 text-sm font-mono p-2 rounded border border-gray-600 focus:outline-none focus:border-blue-500 resize-none"
                          spellCheck={false}
                        />
                      ) : (
                        <pre className="text-sm text-gray-300 whitespace-pre-wrap break-words h-full overflow-auto">
                          {stream.text || (stream.status === 'loading' ? 'Generating…' : 'No code yet')}
                        </pre>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Preview */}
              <div className={`bg-white border border-gray-700 transition-all duration-300 preview-column ${isCodePanelOpen
                ? 'w-1/2 rounded-l-none'
                : 'w-full rounded-l'
                }`}>
                {stream.text && stream.status !== 'error' ? (
                  (() => {
                    const html = extractHtmlFromMarkdown(stream.text);
                    return html ? (
                      <iframe
                        srcDoc={html}
                        className="w-full border-0"
                        style={{
                          minHeight: '400px',
                          overflow: 'visible'
                        }}
                        sandbox="allow-scripts allow-same-origin"
                        title={`HTML Preview ${index + 1}`}
                        onLoad={(e) => {
                          const iframe = e.target as HTMLIFrameElement;
                          onAdjustIframeHeight(iframe, index);
                        }}
                      />
                    ) : (
                      <div className="flex items-center justify-center text-gray-400 text-sm">
                        <p className="text-center px-4">
                          {stream.status === 'loading' ? (
                            'Waiting for HTML block...'
                          ) : (
                            <>
                              No HTML code block found.<br />
                              <span className="text-xs">Looking for ```html ... ```</span>
                            </>
                          )}
                        </p>
                      </div>
                    );
                  })()
                ) : (
                  <div className="flex items-center justify-center h-[400px] text-gray-400 text-sm">
                    {stream.status === 'loading' ? 'Preview loading...' : 'No preview yet'}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        // Text режим
        <div className="flex-1 overflow-auto min-h-[200px]">
          {stream.status === 'error' ? (
            <p className="text-red-300">{stream.error ?? 'Error'}</p>
          ) : isEditing ? (
            <textarea
              value={stream.text}
              onChange={(e) => onUpdateText(index, e.target.value)}
              className="w-full h-full min-h-[200px] bg-gray-800 text-gray-100 text-sm p-3 rounded border border-gray-600 focus:outline-none focus:border-blue-500 resize-none"
              spellCheck={false}
            />
          ) : (
            <div className="whitespace-pre-wrap break-words text-sm text-gray-100">
              {stream.text || (stream.status === 'loading' ? 'Generating…' : 'No content yet')}
            </div>
          )}
        </div>
      )}

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => onToggleEdit(index)}
          className={`${isEditing
            ? 'bg-blue-600 hover:bg-blue-700'
            : 'bg-gray-700 hover:bg-gray-600'
            } text-white text-sm py-2 px-3 rounded-md transition-colors cursor-pointer disabled:opacity-60`}
          disabled={!stream.text || stream.status === 'loading'}
          title={isEditing ? 'Finish editing' : 'Edit text'}
        >
          {isEditing ? '✓ Done' : '✏️ Edit'}
        </button>
        <button
          type="button"
          onClick={() => onCopyToClipboard(index)}
          className="bg-gray-700 hover:bg-gray-600 text-white text-sm py-2 px-3 rounded-md transition-colors cursor-pointer disabled:opacity-60"
          disabled={!stream.text}
          title="Copy to clipboard"
        >
          📋 Copy
        </button>
        <button
          type="button"
          onClick={() => onAbort(index)}
          className="bg-gray-700 hover:bg-gray-600 text-white text-sm py-2 px-3 rounded-md transition-colors cursor-pointer disabled:opacity-60"
          disabled={stream.status !== 'loading'}
          title="Cancel this stream"
        >
          ✕ Cancel
        </button>
      </div>
    </div>
  );
};