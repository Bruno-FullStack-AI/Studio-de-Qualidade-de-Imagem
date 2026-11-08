/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ZoomIn, ZoomOut, RotateCcw, Columns2, Eye, Search, AlertCircle } from 'lucide-react';

interface ImageComparatorProps {
  originalUrl: string;
  upscaledUrl: string;
  originalWidth: number;
  originalHeight: number;
  upscaledWidth: number;
  upscaledHeight: number;
  modelName: string;
  scaleFactor: number;
  isProcessing: boolean;
  progress: number;
  stageLabel: string;
  errorMessage?: string | null;
}

export const ImageComparator: React.FC<ImageComparatorProps> = ({
  originalUrl,
  upscaledUrl,
  originalWidth,
  originalHeight,
  upscaledWidth,
  upscaledHeight,
  modelName,
  scaleFactor,
  isProcessing,
  progress,
  stageLabel,
  errorMessage,
}) => {
  const [viewMode, setViewMode] = useState<'split' | 'side-by-side' | 'loupe'>('split');
  const [sliderPos, setSliderPos] = useState<number>(50);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [isDraggingSlider, setIsDraggingSlider] = useState(false);
  const [loupePos, setLoupePos] = useState<{ x: number; y: number; active: boolean }>({
    x: 50,
    y: 50,
    active: false,
  });

  const containerRef = useRef<HTMLDivElement>(null);

  const updateSliderFromClientX = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    if (rect.width <= 0) return;
    const relX = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const pct = (relX / rect.width) * 100;
    setSliderPos(Math.max(2, Math.min(98, pct)));
  }, []);

  useEffect(() => {
    if (!isDraggingSlider) return;
    const handleMouseMove = (e: MouseEvent) => updateSliderFromClientX(e.clientX);
    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches && e.touches[0]) updateSliderFromClientX(e.touches[0].clientX);
    };
    const handleUp = () => setIsDraggingSlider(false);

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('touchmove', handleTouchMove);
    window.addEventListener('mouseup', handleUp);
    window.addEventListener('touchend', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('mouseup', handleUp);
      window.removeEventListener('touchend', handleUp);
    };
  }, [isDraggingSlider, updateSliderFromClientX]);

  const handleLoupeMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setLoupePos({
      x: Math.max(0, Math.min(100, x)),
      y: Math.max(0, Math.min(100, y)),
      active: true,
    });
  };

  const activeDisplayUpscaled = upscaledUrl || originalUrl;

  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#111726] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
      {/* Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#0D121F]">
        {/* Left: Technical resolution telemetry */}
        <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 font-mono tabular-nums">
          <span>
            Original: <strong className="text-slate-900 dark:text-slate-200">{originalWidth}×{originalHeight}</strong> px
          </span>
          <span aria-hidden="true">·</span>
          <span>
            Upscayl ({scaleFactor}x): <strong className="text-blue-600 dark:text-blue-400">{upscaledWidth}×{upscaledHeight}</strong> px
          </span>
          <span aria-hidden="true" className="hidden sm:inline">·</span>
          <span className="hidden sm:inline text-slate-500 dark:text-slate-400 truncate max-w-[180px]">{modelName}</span>
        </div>

        {/* Right: Interactive View Mode & Zoom Controls */}
        <div className="flex items-center gap-3">
          {/* Segmented View Mode Buttons */}
          <div className="flex items-center gap-1 p-1 bg-slate-200/70 dark:bg-slate-800/80 rounded-lg">
            <button
              type="button"
              onClick={() => setViewMode('split')}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                viewMode === 'split'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              Divisor Interativo
            </button>
            <button
              type="button"
              onClick={() => setViewMode('side-by-side')}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                viewMode === 'side-by-side'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Columns2 className="w-3.5 h-3.5" />
              Lado a Lado
            </button>
            <button
              type="button"
              onClick={() => setViewMode('loupe')}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                viewMode === 'loupe'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Search className="w-3.5 h-3.5" />
              Lupa 300%
            </button>
          </div>

          {/* Zoom Controls */}
          <div className="hidden sm:flex items-center gap-1 border-l border-slate-200 dark:border-slate-800 pl-3">
            <button
              type="button"
              onClick={() => setZoomLevel((z) => Math.max(1, +(z - 0.25).toFixed(2)))}
              disabled={zoomLevel <= 1}
              title="Reduzir Zoom"
              className="p-1.5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white disabled:opacity-40 rounded-md hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-xs font-mono tabular-nums w-12 text-center text-slate-700 dark:text-slate-300">
              {Math.round(zoomLevel * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setZoomLevel((z) => Math.min(3, +(z + 0.25).toFixed(2)))}
              disabled={zoomLevel >= 3}
              title="Aumentar Zoom"
              className="p-1.5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white disabled:opacity-40 rounded-md hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            {zoomLevel !== 1 && (
              <button
                type="button"
                onClick={() => setZoomLevel(1)}
                title="Resetar Zoom"
                className="p-1.5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-md hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Viewport Canvas */}
      <div className="relative flex-1 min-h-[440px] lg:min-h-[560px] studio-checkerboard flex items-center justify-center overflow-hidden select-none p-4">
        {/* Error Notice */}
        {errorMessage && (
          <div className="absolute top-4 left-4 right-4 z-40 bg-rose-500/90 text-white text-xs px-4 py-2.5 rounded-lg flex items-center gap-2 shadow-lg">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Processing Overlay */}
        {isProcessing && (
          <div className="absolute inset-0 z-30 bg-slate-950/75 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-center">
            <div className="w-full max-w-md bg-white dark:bg-[#151D30] border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-xl">
              <div className="flex items-center justify-between text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400 mb-2">
                <span>MOTOR WEB UPSCAYL</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden mb-3">
                <div
                  className="h-full bg-blue-600 transition-all duration-150"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                {stageLabel || 'Processando super-resolução...'}
              </p>
            </div>
          </div>
        )}

        {/* View mode 1: Split Slider */}
        {viewMode === 'split' && (
          <div
            ref={containerRef}
            onMouseDown={(e) => {
              setIsDraggingSlider(true);
              updateSliderFromClientX(e.clientX);
            }}
            onTouchStart={(e) => {
              setIsDraggingSlider(true);
              if (e.touches && e.touches[0]) updateSliderFromClientX(e.touches[0].clientX);
            }}
            className="relative max-w-full max-h-[540px] overflow-hidden rounded-lg border border-slate-300 dark:border-slate-700 cursor-ew-resize shadow-md select-none touch-none"
          >
            {/* Base Layer: Upscaled (After) Image */}
            {activeDisplayUpscaled ? (
              <img
                src={activeDisplayUpscaled}
                alt="Imagem Melhorada com Upscayl"
                referrerPolicy="no-referrer"
                style={{
                  transform: `scale(${zoomLevel})`,
                  transformOrigin: 'center center',
                }}
                className="block max-h-[520px] w-auto object-contain transition-transform duration-150 pointer-events-none"
              />
            ) : null}

            {/* Clipped Overlay Layer: Original (Before) Image */}
            {originalUrl ? (
              <div
                style={{
                  clipPath: `inset(0 ${100 - sliderPos}% 0 0)`,
                }}
                className="absolute inset-0 pointer-events-none"
              >
                <img
                  src={originalUrl}
                  alt="Imagem Original antes do Upscayl"
                  referrerPolicy="no-referrer"
                  style={{
                    transform: `scale(${zoomLevel})`,
                    transformOrigin: 'center center',
                    imageRendering: 'pixelated',
                  }}
                  className="block w-full h-full object-contain transition-transform duration-150"
                />
              </div>
            ) : null}

            {/* Corner Labels */}
            <div className="absolute top-3 left-3 bg-black/75 text-white px-2.5 py-1 rounded text-xs font-mono tracking-tight pointer-events-none shadow-sm">
              ANTES · {originalWidth}×{originalHeight}
            </div>
            <div className="absolute top-3 right-3 bg-blue-600/90 text-white px-2.5 py-1 rounded text-xs font-mono tracking-tight pointer-events-none shadow-sm">
              DEPOIS · {upscaledWidth}×{upscaledHeight} ({scaleFactor}x)
            </div>

            {/* Vertical Divider Line & Handle */}
            <div
              style={{ left: `${sliderPos}%` }}
              className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_10px_rgba(0,0,0,0.7)] pointer-events-none"
            >
              <div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-blue-600 border-2 border-white text-white flex items-center justify-center shadow-lg">
                <span className="text-xs font-mono select-none font-bold">↔</span>
              </div>
            </div>
          </div>
        )}

        {/* View mode 2: Side by Side */}
        {viewMode === 'side-by-side' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full h-full items-center">
            <div className="relative flex flex-col items-center justify-center bg-slate-100/60 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-lg p-3 overflow-hidden">
              <div className="w-full flex items-center justify-between text-xs font-mono text-slate-500 dark:text-slate-400 mb-2">
                <span>ORIGINAL (ANTES)</span>
                <span>{originalWidth}×{originalHeight} px</span>
              </div>
              {originalUrl ? (
                <img
                  src={originalUrl}
                  alt="Original"
                  referrerPolicy="no-referrer"
                  style={{
                    transform: `scale(${zoomLevel})`,
                    imageRendering: 'pixelated',
                  }}
                  className="max-h-[440px] w-auto object-contain rounded transition-transform duration-150 shadow-xs"
                />
              ) : null}
            </div>

            <div className="relative flex flex-col items-center justify-center bg-slate-100/60 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-lg p-3 overflow-hidden">
              <div className="w-full flex items-center justify-between text-xs font-mono text-blue-600 dark:text-blue-400 mb-2">
                <span>MELHORADA ({scaleFactor}X UPSCAYL)</span>
                <span>{upscaledWidth}×{upscaledHeight} px</span>
              </div>
              {activeDisplayUpscaled ? (
                <img
                  src={activeDisplayUpscaled}
                  alt="Melhorada"
                  referrerPolicy="no-referrer"
                  style={{ transform: `scale(${zoomLevel})` }}
                  className="max-h-[440px] w-auto object-contain rounded transition-transform duration-150 shadow-xs"
                />
              ) : null}
            </div>
          </div>
        )}

        {/* View mode 3: Loupe */}
        {viewMode === 'loupe' && (
          <div
            ref={containerRef}
            onMouseMove={handleLoupeMove}
            onMouseLeave={() => setLoupePos((p) => ({ ...p, active: false }))}
            className="relative max-w-full max-h-[540px] overflow-hidden rounded-lg border border-slate-300 dark:border-slate-700 cursor-crosshair shadow-md"
          >
            {activeDisplayUpscaled ? (
              <img
                src={activeDisplayUpscaled}
                alt="Inspeção com Lupa"
                referrerPolicy="no-referrer"
                className="block max-h-[520px] w-auto object-contain"
              />
            ) : null}
            <div className="absolute bottom-3 left-3 bg-black/80 text-white px-3 py-1.5 rounded text-xs pointer-events-none shadow-sm">
              Passe o cursor sobre a foto para inspecionar os detalhes restaurados em 300%
            </div>

            {loupePos.active && (
              <div
                style={{
                  left: `${loupePos.x}%`,
                  top: `${loupePos.y}%`,
                  backgroundImage: `url(${activeDisplayUpscaled})`,
                  backgroundPosition: `${loupePos.x}% ${loupePos.y}%`,
                  backgroundSize: '340%',
                }}
                className="absolute -translate-x-1/2 -translate-y-1/2 w-48 h-48 rounded-full border-2 border-blue-500 shadow-2xl pointer-events-none bg-no-repeat z-20"
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
};
