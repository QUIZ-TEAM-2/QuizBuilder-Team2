"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
} from "react";
import { getSliderIntervalIndex, snapSliderValueToTick } from "./types";

export interface SliderViewProps {
  min: number;
  max: number;
  divisions: number;
  defaultValue: number;
  trackColor?: string;
  rangeColor?: string;
  textColor?: string;
  showValue?: boolean;
  sliderValue?: number;
  isEditable?: boolean;
  onSliderChange?: (value: number, intervalIndex: number) => void;
}

export function SliderView({
  min,
  max,
  divisions,
  defaultValue,
  trackColor = "#E5E7EB",
  rangeColor = "#2563EB",
  textColor = "#111827",
  showValue = true,
  sliderValue,
  isEditable = false,
  onSliderChange,
}: SliderViewProps) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const activePointerIdRef = useRef<number | null>(null);
  const resolvedValue = snapSliderValueToTick(
    sliderValue ?? defaultValue,
    min,
    max,
    divisions,
  );
  const [localValue, setLocalValue] = useState(resolvedValue);

  useEffect(() => {
    setLocalValue(resolvedValue);
  }, [resolvedValue]);

  const ticks = useMemo(
    () => Array.from({ length: divisions + 1 }, (_, index) => index),
    [divisions],
  );
  const tickLabels = useMemo(
    () =>
      ticks.map((index) => ({
        label: String(min + index),
        left: (index / divisions) * 100,
      })),
    [divisions, min, ticks],
  );
  const thumbLeft = useMemo(() => {
    const range = max - min;
    if (range <= 0) return 0;
    return ((localValue - min) / range) * 100;
  }, [localValue, max, min]);

  const getValueFromClientX = (clientX: number) => {
    const track = trackRef.current;
    if (!track) return localValue;
    const rect = track.getBoundingClientRect();
    const ratio = rect.width <= 0 ? 0 : (clientX - rect.left) / rect.width;
    return Math.min(Math.max(min + ratio * (max - min), min), max);
  };

  const commitValue = (value: number) => {
    const nextValue = snapSliderValueToTick(value, min, max, divisions);
    const nextInterval = getSliderIntervalIndex({
      value: nextValue,
      min,
      max,
      divisions,
    });

    setLocalValue(nextValue);
    onSliderChange?.(nextValue, nextInterval);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (isEditable) return;
    if (activePointerIdRef.current !== event.pointerId) return;
    setLocalValue(getValueFromClientX(event.clientX));
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (isEditable) return;
    activePointerIdRef.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    setLocalValue(getValueFromClientX(event.clientX));
  };

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (isEditable) return;
    if (activePointerIdRef.current !== event.pointerId) return;
    commitValue(getValueFromClientX(event.clientX));
    activePointerIdRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handlePointerCancel = (event: PointerEvent<HTMLDivElement>) => {
    if (activePointerIdRef.current !== event.pointerId) return;
    commitValue(localValue);
    activePointerIdRef.current = null;
  };

  return (
    <div
      data-slider-colors
      className="flex h-full w-full flex-col justify-center gap-3 overflow-hidden px-4 py-2"
      style={
        {
          color: textColor,
          "--slider-track": trackColor,
          "--slider-range": rangeColor,
        } as CSSProperties
      }
    >
      <div
        ref={trackRef}
        className="relative h-11 touch-none pb-5 pt-3"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
      >
        <div className="absolute inset-x-0 top-3 h-1.5 rounded-full bg-[var(--slider-track)]" />
        <div className="pointer-events-none absolute inset-x-0 top-3 z-10 h-8">
          {ticks.map((tick, index) => (
            <div
              key={`${tick}-${index}`}
              className="absolute top-0 z-20 flex flex-col items-center"
              style={{ left: `${(index / divisions) * 100}%` }}
            >
              <div className="h-3 w-px -translate-x-1/2 bg-current" />
            </div>
          ))}
          {showValue &&
            tickLabels.map((item) => (
              <div
                key={item.label}
                className="absolute top-4 -translate-x-1/2 whitespace-nowrap text-center text-xs font-semibold tabular-nums leading-none"
                style={{ left: `${item.left}%` }}
              >
                {item.label}
              </div>
            ))}
        </div>
        <div
          className="absolute top-3 z-40 flex h-9 w-9 -translate-x-1/2 -translate-y-[15px] cursor-grab items-center justify-center active:cursor-grabbing"
          style={{ left: `${thumbLeft}%` }}
        >
          <div className="flex h-5 w-5 items-center justify-center rounded-full border border-slate-900/20 bg-white shadow-[0_2px_8px_rgba(15,23,42,0.22)]">
            <div className="h-1.5 w-1.5 rounded-full bg-slate-900" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default SliderView;
