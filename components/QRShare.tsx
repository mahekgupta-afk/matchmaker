"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";

export default function QRShare({ url }: { url: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, url, { width: 240, margin: 1, color: { dark: "#1c1917" } });
    }
  }, [url]);

  async function handleShare() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) return;
    const file = new File([blob], "tonight-invite.png", { type: "image/png" });
    const canShareFiles =
      typeof navigator !== "undefined" &&
      "canShare" in navigator &&
      navigator.canShare?.({ files: [file] });

    if (canShareFiles) {
      try {
        await navigator.share({
          files: [file],
          title: "What should we watch tonight?",
          text: "Scan this to pick tonight's movie together",
        });
        return;
      } catch {
        // user cancelled or share failed — fall through to copy link
      }
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
        <canvas ref={canvasRef} />
      </div>
      <button
        onClick={handleShare}
        className="rounded-full bg-rose-500 px-6 py-3 text-sm font-semibold text-white shadow-sm active:scale-95"
      >
        {copied ? "Link copied!" : "Share invite"}
      </button>
      <p className="max-w-xs text-center text-xs text-neutral-500">
        Can&apos;t scan? Send this link instead:{" "}
        <button
          onClick={() => {
            navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
          className="underline"
        >
          {url}
        </button>
      </p>
    </div>
  );
}
