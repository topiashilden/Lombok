"use client";

import { useRef, useState } from "react";
import { Camera } from "lucide-react";
import { IconTile, secondaryButton } from "@/components/solvo/ui";
import type { Reading } from "@/lib/einvoice";

const MAX_SIDE = 1600;

// Phone photos are several MB; shrink to a JPEG that reads well and fits a serverless request.
async function toJpegDataUrl(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Secondary path: a bill that never arrives as an e-invoice. Same reading, same comparison. */
export function PhotoUpload({ onRead }: { onRead: (r: { reading: Reading; ms: number; model?: string }) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<{ busy: boolean; error?: string }>({ busy: false });

  async function handle(file: File) {
    setState({ busy: true });
    try {
      const image = await toJpegDataUrl(file);
      const res = await fetch("/api/read-photo", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ image }),
      });
      const d = await res.json();
      if (!res.ok || !d.reading) throw new Error(d.error ?? "Couldn't read the photo.");
      onRead(d);
      setState({ busy: false });
    } catch (e) {
      setState({ busy: false, error: e instanceof Error ? e.message : "Couldn't read the photo." });
    } finally {
      if (input.current) input.current.value = "";
    }
  }

  return (
    <section className="mt-7 rounded-2xl border border-dashed border-border p-4">
      <div className="flex items-start gap-3">
        <IconTile tone="grey">
          <Camera />
        </IconTile>
        <div>
          <p className="text-[15px] font-medium">A bill that isn&apos;t an e-invoice?</p>
          <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">
            A paper bill, or one you pay from another bank. Take a photo and Solvo reads it the same way.
          </p>
        </div>
      </div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && handle(e.target.files[0])}
      />
      <button type="button" disabled={state.busy} onClick={() => input.current?.click()} className={`${secondaryButton} mt-4`}>
        {state.busy ? "Reading your photo…" : "Photograph a bill"}
      </button>
      {state.error && <p className="mt-2 text-[13px] text-warn">{state.error}</p>}
    </section>
  );
}
