import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";

export const runtime = "edge";

function lockJSX(size: number) {
  // All measurements derived proportionally from a 192-unit base
  const s = size / 192;
  const shackleW = Math.round(74 * s);
  const shackleH = Math.round(55 * s);
  const border = Math.round(15 * s);
  const shackleR = Math.round(39 * s);
  const bodyW = Math.round(100 * s);
  const bodyH = Math.round(70 * s);
  const bodyR = Math.round(12 * s);
  const overlap = Math.round(border);

  return (
    <div
      style={{
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(145deg, #FF6B35 0%, #E8530C 100%)",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        {/* Shackle — open-bottom border arc */}
        <div
          style={{
            width: shackleW,
            height: shackleH,
            borderTop: `${border}px solid rgba(255,255,255,0.93)`,
            borderLeft: `${border}px solid rgba(255,255,255,0.93)`,
            borderRight: `${border}px solid rgba(255,255,255,0.93)`,
            borderTopLeftRadius: shackleR,
            borderTopRightRadius: shackleR,
            marginBottom: -overlap,
          }}
        />
        {/* Body */}
        <div
          style={{
            width: bodyW,
            height: bodyH,
            background: "rgba(255,255,255,0.93)",
            borderRadius: bodyR,
          }}
        />
      </div>
    </div>
  );
}

export function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("size");
  const size = raw === "512" ? 512 : 192;

  return new ImageResponse(lockJSX(size), { width: size, height: size });
}
