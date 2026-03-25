import { useState, useCallback, useRef } from 'react';

export function useResizableColumns(initialWidths: number[]) {
  const [widths, setWidths] = useState(initialWidths);
  const dragging = useRef<{ index: number; startX: number; startWidth: number } | null>(null);

  const onMouseDown = useCallback((index: number, e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = { index, startX: e.clientX, startWidth: widths[index] };

    const onMouseMove = (ev: MouseEvent) => {
      if (!dragging.current) return;
      const diff = ev.clientX - dragging.current.startX;
      const newWidth = Math.max(40, dragging.current.startWidth + diff);
      setWidths(prev => {
        const next = [...prev];
        next[dragging.current!.index] = newWidth;
        return next;
      });
    };

    const onMouseUp = () => {
      dragging.current = null;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [widths]);

  return { widths, onMouseDown };
}

export function ResizeHandle({ index, onMouseDown }: { index: number; onMouseDown: (index: number, e: React.MouseEvent) => void }) {
  return (
    <div
      className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/30 transition-colors z-10"
      onMouseDown={e => onMouseDown(index, e)}
    />
  );
}
