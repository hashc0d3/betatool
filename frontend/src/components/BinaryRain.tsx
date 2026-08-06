"use client";

import { useMemo } from "react";

function makeColumn(seed: number, length: number): string {
  const chars: string[] = [];
  let x = (seed * 1103515245 + 12345) >>> 0;
  for (let i = 0; i < length; i++) {
    x = (x * 1664525 + 1013904223) >>> 0;
    chars.push(x & 1 ? "1" : "0");
  }
  return chars.join("\n");
}

/** Зелёный фон из нулей и единиц — бесшовный цикл */
export function BinaryRain() {
  const columns = useMemo(() => {
    return Array.from({ length: 32 }, (_, i) => {
      const text = makeColumn(i + 7, 56);
      return {
        id: i,
        text,
        left: `${(i / 32) * 100 + 0.4}%`,
        duration: `${14 + (i % 8) * 1.6}s`,
        delay: `${-((i * 1.7) % 12)}s`,
        opacity: 0.08 + (i % 6) * 0.03,
        fontSize: i % 3 === 0 ? "12px" : i % 3 === 1 ? "11px" : "10px",
      };
    });
  }, []);

  return (
    <div className="binary-rain" aria-hidden="true">
      {columns.map((col) => (
        <div
          key={col.id}
          className="binary-rain__col"
          style={{
            left: col.left,
            opacity: col.opacity,
            fontSize: col.fontSize,
          }}
        >
          <div
            className="binary-rain__track"
            style={{
              animationDuration: col.duration,
              animationDelay: col.delay,
            }}
          >
            <span className="binary-rain__chunk">{col.text}</span>
            <span className="binary-rain__chunk" aria-hidden="true">
              {col.text}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
