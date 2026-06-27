import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width: 180,
        height: 180,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        // iOS clips to rounded square automatically — no borderRadius needed
        background: "linear-gradient(145deg, #FF6B35 0%, #E8530C 100%)",
      }}
    >
      <div
        style={{ display: "flex", flexDirection: "column", alignItems: "center" }}
      >
        <div
          style={{
            width: 69,
            height: 51,
            borderTop: "14px solid rgba(255,255,255,0.93)",
            borderLeft: "14px solid rgba(255,255,255,0.93)",
            borderRight: "14px solid rgba(255,255,255,0.93)",
            borderTopLeftRadius: 37,
            borderTopRightRadius: 37,
            marginBottom: -14,
          }}
        />
        <div
          style={{
            width: 94,
            height: 66,
            background: "rgba(255,255,255,0.93)",
            borderRadius: 11,
          }}
        />
      </div>
    </div>,
    { width: 180, height: 180 }
  );
}
