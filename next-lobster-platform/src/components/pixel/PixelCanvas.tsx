'use client';

import { useRef, useState, useCallback, useEffect } from 'react';

export type Color = string;

export const LOBSTER_COLORS: Color[] = [
  '#E74C3C', // 红
  '#E67E22', // 橙
  '#F1C40F', // 黄
  '#2ECC71', // 绿
  '#1ABC9C', // 青
  '#3498DB', // 蓝
  '#9B59B6', // 紫
  '#E91E63', // 粉
  '#795548', // 棕
  '#FFFFFF', // 白
  '#9E9E9E', // 灰
  '#111111', // 黑
  '#00BCD4', // 天蓝
  '#FF5722', // 深橙
  '#8BC34A', // 浅绿
  '#FFEB3B', // 亮黄
];

export const DEFAULT_GRID = 24;
export const EMPTY_PIXEL = 'transparent';

export const GRID_SIZE_OPTIONS = [8, 12, 16, 24, 32, 48];

interface PixelCanvasProps {
  gridSize: number;
  initialPixels?: string[][];
  onPixelsChange?: (pixels: string[][]) => void;
}

export function PixelCanvas({
  gridSize,
  initialPixels,
  onPixelsChange,
}: PixelCanvasProps) {
  const [pixels, setPixels] = useState<string[][]>(() => {
    if (initialPixels) return initialPixels;
    return Array.from({ length: gridSize }, () =>
      Array.from({ length: gridSize }, () => EMPTY_PIXEL)
    );
  });
  const [selectedColor, setSelectedColor] = useState<Color>(LOBSTER_COLORS[0]);
  const [isDrawing, setIsDrawing] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);

  // 当 gridSize 变化时，初始化新画布
  useEffect(() => {
    const next = Array.from({ length: gridSize }, () =>
      Array.from({ length: gridSize }, () => EMPTY_PIXEL)
    );
    setPixels(next);
    onPixelsChange?.(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gridSize]);

  const setPixel = useCallback(
    (row: number, col: number, color: Color) => {
      setPixels((prev) => {
        if (row >= prev.length || col >= prev[0].length) return prev;
        const next = prev.map((r) => [...r]);
        next[row][col] = color;
        onPixelsChange?.(next);
        return next;
      });
    },
    [onPixelsChange]
  );

  const handlePointerDown = (row: number, col: number, e: React.PointerEvent) => {
    e.preventDefault();
    setIsDrawing(true);
    const target = e.currentTarget as HTMLElement;
    if (e.button === 2) {
      target.style.backgroundColor = EMPTY_PIXEL;
      setPixel(row, col, EMPTY_PIXEL);
    } else {
      target.style.backgroundColor = selectedColor;
      setPixel(row, col, selectedColor);
    }
  };

  const handlePointerEnter = (row: number, col: number, e: React.PointerEvent) => {
    if (!isDrawing) return;
    const target = e.currentTarget as HTMLElement;
    if (e.buttons === 2) {
      target.style.backgroundColor = EMPTY_PIXEL;
      setPixel(row, col, EMPTY_PIXEL);
    } else {
      target.style.backgroundColor = selectedColor;
      setPixel(row, col, selectedColor);
    }
  };

  const handlePointerUp = () => setIsDrawing(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const stop = () => setIsDrawing(false);
    canvas.addEventListener('pointerup', stop);
    return () => canvas.removeEventListener('pointerup', stop);
  }, []);

  const clearCanvas = () => {
    const empty = Array.from({ length: gridSize }, () =>
      Array.from({ length: gridSize }, () => EMPTY_PIXEL)
    );
    setPixels(empty);
    onPixelsChange?.(empty);
  };

  const fillCanvas = () => {
    const filled = Array.from({ length: gridSize }, () =>
      Array.from({ length: gridSize }, () => selectedColor)
    );
    setPixels(filled);
    onPixelsChange?.(filled);
  };

  const eraserMode = selectedColor === EMPTY_PIXEL;

  return (
    <div className="flex flex-col gap-3">
      {/* Grid */}
      <div
        ref={canvasRef}
        className="inline-grid border-4 border-pixel-black mx-auto select-none"
        style={{
          gridTemplateColumns: `repeat(${gridSize}, 1fr)`,
          width: 'min(100%, 360px)',
          aspectRatio: '1',
          boxShadow: '6px 6px 0 #101010',
          touchAction: 'none',
        }}
        onContextMenu={(e) => e.preventDefault()}
      >
        {pixels.map((row, r) =>
          row.map((color, c) => (
            <div
              key={`${r}-${c}`}
              onPointerDown={(e) => handlePointerDown(r, c, e)}
              onPointerEnter={(e) => handlePointerEnter(r, c, e)}
              className={`
                border-r border-b border-pixel-black/10
                ${eraserMode ? 'cursor-cell' : 'cursor-crosshair'}
              `}
              style={{ backgroundColor: color === EMPTY_PIXEL ? '#ffffff' : color }}
            />
          ))
        )}
      </div>

      {/* Color Palette */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="font-pixel text-xs text-pixel-black/60">调色板</p>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={clearCanvas}
              className="px-2 py-1 border-2 border-pixel-black font-pixel text-xs bg-pixel-white hover:bg-pixel-gray transition-colors"
              style={{ boxShadow: '2px 2px 0 #101010' }}
            >
              清空
            </button>
            <button
              type="button"
              onClick={fillCanvas}
              className="px-2 py-1 border-2 border-pixel-black font-pixel text-xs bg-pixel-white hover:bg-pixel-gray transition-colors"
              style={{ boxShadow: '2px 2px 0 #101010' }}
            >
              填满
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-1">
          {/* Eraser */}
          <button
            type="button"
            title="橡皮擦"
            onClick={() => setSelectedColor(EMPTY_PIXEL)}
            className={`
              w-7 h-7 border-4 border-pixel-black font-pixel text-xs flex items-center justify-center
              ${selectedColor === EMPTY_PIXEL ? 'ring-2 ring-pixel-blue ring-offset-1' : ''}
              bg-white
            `}
            style={{ boxShadow: '2px 2px 0 #101010' }}
          >
            ✕
          </button>
          {LOBSTER_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              title={color}
              onClick={() => setSelectedColor(color)}
              className={`
                w-7 h-7 border-4 border-pixel-black
                ${selectedColor === color ? 'ring-2 ring-pixel-blue ring-offset-1' : ''}
              `}
              style={{
                backgroundColor: color,
                boxShadow: '2px 2px 0 #101010',
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
