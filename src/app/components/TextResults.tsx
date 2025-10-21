import { StreamResult } from './StreamResult';
import { StreamState, Mode } from '@/types/stream';

interface TextResultsProps {
  streams: StreamState[];
  mode: Mode;
  editingStates: boolean[];
  openCodePanels: boolean[];
  iframeHeights: number[];
  onToggleEdit: (index: number) => void;
  onUpdateText: (index: number, text: string) => void;
  onCopyToClipboard: (index: number) => void;
  onAbort: (index: number) => void;
  onToggleCodePanel: (index: number) => void;
  onAdjustIframeHeight: (iframe: HTMLIFrameElement, index: number) => void;
}

export function TextResults({
  streams,
  mode,
  editingStates,
  openCodePanels,
  iframeHeights,
  onToggleEdit,
  onUpdateText,
  onCopyToClipboard,
  onAbort,
  onToggleCodePanel,
  onAdjustIframeHeight
}: TextResultsProps) {
  return (
    <>
      {streams.map((s, i) => (
        <StreamResult
          key={i}
          stream={s}
          index={i}
          mode={mode}
          isEditing={editingStates[i]}
          isCodePanelOpen={openCodePanels[i]}
          iframeHeight={iframeHeights[i] || 400}
          onToggleEdit={onToggleEdit}
          onUpdateText={onUpdateText}
          onCopyToClipboard={onCopyToClipboard}
          onAbort={onAbort}
          onToggleCodePanel={onToggleCodePanel}
          onAdjustIframeHeight={onAdjustIframeHeight}
        />
      ))}
    </>
  );
}