"use client";

import { useEffect, useRef } from "react";

interface RecordingVisualizerProps {
  analyserNode: AnalyserNode | null;
  isActive: boolean; // true when recording, false when paused/idle
}

const BAR_COUNT = 24;

export function RecordingVisualizer({
  analyserNode,
  isActive,
}: RecordingVisualizerProps) {
  const barsRef = useRef<(HTMLDivElement | null)[]>([]);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!analyserNode || !isActive) {
      // Show flat/idle bars
      barsRef.current.forEach((bar, i) => {
        if (bar) {
          const h = 15 + Math.sin(i * 0.8) * 8;
          bar.style.height = `${h}%`;
          bar.style.opacity = "0.3";
        }
      });
      return;
    }

    const dataArray = new Uint8Array(analyserNode.frequencyBinCount);

    function draw() {
      if (!analyserNode) return;
      analyserNode.getByteFrequencyData(dataArray);

      // Use low-mid frequency range (most relevant for voice)
      const usableBins = Math.floor(dataArray.length * 0.4);
      const step = Math.floor(usableBins / BAR_COUNT);

      barsRef.current.forEach((bar, i) => {
        if (!bar) return;
        const binIndex = i * step;
        const value = dataArray[binIndex] ?? 0;
        // Map 0–255 to 10%–100% height
        const height = 10 + (value / 255) * 90;
        bar.style.height = `${height}%`;
        bar.style.opacity = value > 10 ? "1" : "0.4";
      });

      rafRef.current = requestAnimationFrame(draw);
    }

    draw();

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [analyserNode, isActive]);

  return (
    <div className="flex items-center justify-center gap-[3px] h-12 w-full px-2">
      {Array.from({ length: BAR_COUNT }).map((_, i) => (
        <div
          key={i}
          ref={(el) => { barsRef.current[i] = el; }}
          className="flex-1 rounded-full bg-red-400 transition-none"
          style={{ height: "15%", minWidth: "3px", maxWidth: "8px" }}
        />
      ))}
    </div>
  );
}
