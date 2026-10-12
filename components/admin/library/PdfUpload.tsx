"use client";

import { useRef, useState } from "react";
import { FileText, UploadCloud, X } from "lucide-react";
import { cn } from "@/lib/cn";

export type UploadedPdf = { uploadId: string; fileName: string; sizeBytes: number; pageCount: number | null };

const MAX = 25 * 1024 * 1024;
const size = (b: number) => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

/** PUT with upload progress (fetch has none). */
function put(url: string, file: File, headers: Record<string, string>, onProgress: (p: number) => void): Promise<number> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => resolve(xhr.status);
    xhr.onerror = () => reject(new Error("network"));
    xhr.send(file);
  });
}

/**
 * Choose or drop a PDF (≤ 25 MB, PLAN D97): sign → PUT straight to storage → complete. The file never
 * passes through a Server Action; the save claims it by `uploadId`.
 */
export function PdfUpload({ current, value, onChange, disabled, error }: { current: { sizeBytes: number; pageCount: number | null } | null; value: UploadedPdf | null; onChange: (u: UploadedPdf | null) => void; disabled?: boolean; error?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [over, setOver] = useState(false);

  const upload = async (file: File) => {
    setProblem(null);
    if (file.type !== "application/pdf" && !/\.pdf$/i.test(file.name)) return setProblem("Please choose a PDF file.");
    if (file.size > MAX) return setProblem("This file is bigger than 25 MB. Please make it smaller and try again.");
    setProgress(0);
    try {
      const signed = await fetch("/api/admin/uploads/sign", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fileName: file.name, contentType: "application/pdf", sizeBytes: file.size }) });
      const s = (await signed.json()) as { uploadId?: string; url?: string; headers?: Record<string, string>; message?: string };
      if (!signed.ok || !s.uploadId || !s.url) throw new Error(s.message ?? "The upload couldn't start.");
      const status = await put(s.url, file, s.headers ?? { "Content-Type": "application/pdf" }, setProgress);
      if (status < 200 || status >= 300) throw new Error("The file didn't upload. Please try again.");
      const done = await fetch("/api/admin/uploads/complete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ uploadId: s.uploadId }) });
      const c = (await done.json()) as UploadedPdf & { message?: string };
      if (!done.ok) throw new Error(c.message ?? "The file couldn't be checked.");
      onChange({ uploadId: c.uploadId, fileName: c.fileName, sizeBytes: c.sizeBytes, pageCount: c.pageCount });
    } catch (e) {
      setProblem(e instanceof Error ? e.message : "The file didn't upload. Please try again.");
    } finally {
      setProgress(null);
    }
  };

  return (
    <div className="grid gap-2">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          const f = e.dataTransfer.files?.[0];
          if (f && !disabled) void upload(f);
        }}
        className={cn("flex flex-wrap items-center gap-3 rounded-[18px] border-2 border-dashed p-4 transition-colors", over ? "border-forest bg-mint/40" : "border-line bg-sand/30", (error || problem) && "border-coral-800")}
      >
        <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-full bg-white text-forest">
          {value || current ? <FileText className="size-5" /> : <UploadCloud className="size-5" />}
        </span>
        <div className="min-w-0 flex-1">
          {value ? (
            <p className="text-[15px] font-bold text-ink">
              {value.fileName} <span className="font-normal text-body">· {size(value.sizeBytes)}{value.pageCount ? ` · ${value.pageCount} pages` : ""} · ready</span>
            </p>
          ) : current ? (
            <p className="text-[15px] font-bold text-ink">
              The current PDF <span className="font-normal text-body">· {size(current.sizeBytes)}{current.pageCount ? ` · ${current.pageCount} pages` : ""}</span>
            </p>
          ) : (
            <p className="text-[15px] font-bold text-ink">Drop the PDF here, or choose it</p>
          )}
          <p className="text-[13px] text-body">{progress !== null ? `Uploading… ${Math.round(progress * 100)}%` : "PDF only, up to 25 MB."}</p>
          {progress !== null ? (
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white">
              <div className="h-full rounded-full bg-forest transition-[width]" style={{ width: `${Math.round(progress * 100)}%` }} />
            </div>
          ) : null}
        </div>
        <div className="flex gap-2">
          {value ? (
            <button type="button" aria-label="Remove the new file" onClick={() => onChange(null)} className="grid size-10 place-items-center rounded-full text-body hover:bg-white">
              <X aria-hidden className="size-4" />
            </button>
          ) : null}
          <button
            type="button"
            disabled={disabled || progress !== null}
            onClick={() => input.current?.click()}
            className="inline-flex h-10 items-center rounded-full border border-line bg-white px-4 text-[14px] font-bold text-ink hover:border-forest disabled:opacity-50"
          >
            {value || current ? "Choose another" : "Choose a PDF"}
          </button>
        </div>
        <input
          ref={input}
          id="file"
          type="file"
          aria-label="PDF file"
          accept="application/pdf,.pdf"
          className="sr-only"
          tabIndex={-1}
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) void upload(f);
          }}
        />
      </div>
      {problem || error ? (
        <p role="alert" className="text-[14px] font-semibold text-coral-800">
          {problem ?? error}
        </p>
      ) : null}
    </div>
  );
}
