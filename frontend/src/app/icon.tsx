import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        width: 32,
        height: 32,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(145deg, #FF6B35 0%, #E8530C 100%)",
        borderRadius: 7,
      }}
    >
      <div
        style={{ display: "flex", flexDirection: "column", alignItems: "center" }}
      >
        <div
          style={{
            width: 12,
            height: 9,
            borderTop: "2.5px solid rgba(255,255,255,0.93)",
            borderLeft: "2.5px solid rgba(255,255,255,0.93)",
            borderRight: "2.5px solid rgba(255,255,255,0.93)",
            borderTopLeftRadius: 7,
            borderTopRightRadius: 7,
            marginBottom: -2,
          }}
        />
        <div
          style={{
            width: 17,
            height: 11,
            background: "rgba(255,255,255,0.93)",
            borderRadius: 2,
          }}
        />
      </div>
    </div>,
    { width: 32, height: 32 }
  );
}
