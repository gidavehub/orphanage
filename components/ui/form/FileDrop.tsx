"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, FileText, Image as ImageIcon, Lock, Upload, X } from "lucide-react";
import { IconDisc } from "../IconDisc";
import { ProgressBar } from "../ProgressBar";
import { cn } from "@/lib/cn";

export type UploadStatus = "preparing" | "uploading" | "done" | "error";

export type UploadItem = {
  id: string;
  name: string;
  size: number;
  type: string;
  status: UploadStatus;
  /** 0–100 while uploading. */
  progress: number;
  /** The upload token returned by the route (submitted with the form). */
  token?: string;
  error?: string;
};

export type FileDropProps = {
  /** Form field that carries one upload token per finished file (intake reads `fd.getAll("upload")`). */
  name?: string;
  /**
   * Where each file is POSTed, one per request, as multipart field `file` (D96: `/api/uploads`).
   * The route answers `{ uploadToken }`. `null` hides the zone: storage is not connected.
   */
  uploadUrl: string | null;
  /** Accepted types: extensions and/or MIME types, e.g. ".pdf,.jpg,.jpeg,.png,.webp". */
  accept: string;
  /** Per-file limit after downscaling (public uploads: 4). */
  maxSizeMb: number;
  /** Default 5 (D96). */
  maxFiles?: number;
  hint?: React.ReactNode;
  /** Adds "Only the officer handling your request can open these files." */
  sensitive?: boolean;
  /** Called whenever the list changes (e.g. to keep the submit button pending while uploading). */
  onFiles?: (items: UploadItem[]) => void;
  /** Photos are shrunk in the browser first: canvas → JPEG (data-model §10.6). `false` sends originals. */
  downscale?: { maxEdge: number; quality: number } | false;
  /** Extra multipart fields sent with each file (e.g. the form id). */
  extraFields?: Record<string, string>;
  disabled?: boolean;
  /** Shown instead of the zone when `uploadUrl` is null. */
  unavailableText?: string;
  id?: string;
  invalid?: boolean;
  "aria-describedby"?: string;
  className?: string;
};

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const sizeFmt = new Intl.NumberFormat("en", { maximumFractionDigits: 1 });

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${sizeFmt.format(n / 1024)} KB`;
  return `${sizeFmt.format(n / (1024 * 1024))} MB`;
}

function accepts(file: File, accept: string) {
  const rules = accept
    .split(",")
    .map((r) => r.trim().toLowerCase())
    .filter(Boolean);
  if (rules.length === 0) return true;
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  return rules.some((r) => (r.startsWith(".") ? name.endsWith(r) : r.endsWith("/*") ? type.startsWith(r.slice(0, -1)) : type === r));
}

function describeAccept(accept: string) {
  const ext = accept
    .split(",")
    .map((r) => r.trim())
    .filter(Boolean)
    .map((r) => (r.startsWith(".") ? r.slice(1) : (r.split("/")[1] ?? r)))
    .map((r) => r.toUpperCase().replace("JPEG", "JPG"));
  return Array.from(new Set(ext)).join(", ");
}

/** Shrinks a photo to `maxEdge` and re-encodes it as JPEG on a white ground (EXIF is dropped too). */
async function shrink(file: File, maxEdge: number, quality: number): Promise<File> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return file;
  }
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
  if (!blob) return file;
  const base = file.name.replace(/\.[^.]+$/, "") || "photo";
  return new File([blob], `${base}.jpg`, { type: "image/jpeg", lastModified: file.lastModified });
}

function errorFor(status: number, body: unknown): string {
  const msg = body && typeof body === "object" ? ((body as { error?: unknown; message?: unknown }).message ?? (body as { error?: unknown }).error) : null;
  if (typeof msg === "string" && msg.length < 200) return msg;
  if (status === 413) return "This file is too big.";
  if (status === 415) return "This type of file can't be accepted.";
  if (status === 429) return "Too many uploads for now. Please wait a few minutes and try again.";
  if (status === 503) return "Uploads aren't switched on yet. Our team will ask for documents securely if they're needed.";
  return "This file didn't upload. Please try again.";
}

let seq = 0;

/**
 * File upload zone (design-system §3.3, D96): drop or choose files, photos shrink in the browser,
 * then each file is POSTed on its own with live progress. Finished files become hidden `upload`
 * token inputs, so the form itself never carries a file. The whole zone is one big tap target.
 */
export function FileDrop({
  name = "upload",
  uploadUrl,
  accept,
  maxSizeMb,
  maxFiles = 5,
  hint,
  sensitive,
  onFiles,
  downscale = { maxEdge: 2000, quality: 0.85 },
  extraFields,
  disabled,
  unavailableText = "If documents are needed, our team will ask you for them securely.",
  id,
  invalid,
  "aria-describedby": describedBy,
  className,
}: FileDropProps) {
  const [items, setItems] = useState<UploadItem[]>([]);
  const [over, setOver] = useState(false);
  const [announce, setAnnounce] = useState("");
  const xhrs = useRef(new Map<string, XMLHttpRequest>());
  const onFilesRef = useRef(onFiles);
  useEffect(() => {
    onFilesRef.current = onFiles;
  }, [onFiles]);
  useEffect(() => {
    onFilesRef.current?.(items);
  }, [items]);
  useEffect(() => {
    const map = xhrs.current;
    return () => {
      map.forEach((x) => x.abort());
      map.clear();
    };
  }, []);

  const maxBytes = maxSizeMb * 1024 * 1024;
  const patch = (fileId: string, p: Partial<UploadItem>) => setItems((xs) => xs.map((x) => (x.id === fileId ? { ...x, ...p } : x)));

  const upload = (fileId: string, file: File) => {
    if (!uploadUrl) return;
    const fd = new FormData();
    fd.append("file", file, file.name);
    for (const [k, v] of Object.entries(extraFields ?? {})) fd.append(k, v);
    const xhr = new XMLHttpRequest();
    xhrs.current.set(fileId, xhr);
    xhr.open("POST", uploadUrl);
    xhr.responseType = "json";
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) patch(fileId, { progress: Math.round((e.loaded / e.total) * 100) });
    };
    xhr.onload = () => {
      xhrs.current.delete(fileId);
      const body = xhr.response as { uploadToken?: string; token?: string } | null;
      const token = body?.uploadToken ?? body?.token;
      if (xhr.status >= 200 && xhr.status < 300 && token) {
        patch(fileId, { status: "done", progress: 100, token });
        setAnnounce(`${file.name} uploaded.`);
      } else {
        const error = errorFor(xhr.status, xhr.response);
        patch(fileId, { status: "error", error });
        setAnnounce(`${file.name}: ${error}`);
      }
    };
    xhr.onerror = () => {
      xhrs.current.delete(fileId);
      const error = "The connection dropped. Please try again.";
      patch(fileId, { status: "error", error });
      setAnnounce(`${file.name}: ${error}`);
    };
    xhr.send(fd);
  };

  const add = async (list: FileList | File[]) => {
    const files = Array.from(list);
    const room = maxFiles - items.filter((x) => x.status !== "error").length;
    if (room <= 0) {
      setAnnounce(`You can add up to ${maxFiles} files.`);
      return;
    }
    for (const original of files.slice(0, room)) {
      const fileId = `f${++seq}`;
      const base: UploadItem = { id: fileId, name: original.name, size: original.size, type: original.type, status: "preparing", progress: 0 };
      if (!accepts(original, accept)) {
        setItems((xs) => [...xs, { ...base, status: "error", error: `This type of file can't be accepted. Use ${describeAccept(accept)}.` }]);
        continue;
      }
      setItems((xs) => [...xs, base]);
      let file = original;
      if (downscale && IMAGE_TYPES.includes(original.type)) {
        try {
          file = await shrink(original, downscale.maxEdge, downscale.quality);
        } catch {
          file = original;
        }
      }
      if (file.size > maxBytes) {
        patch(fileId, { status: "error", size: file.size, error: `This file is ${formatBytes(file.size)}. The limit is ${maxSizeMb} MB.` });
        continue;
      }
      patch(fileId, { status: "uploading", size: file.size, name: file.name, type: file.type });
      upload(fileId, file);
    }
    if (files.length > room) setAnnounce(`Only ${maxFiles} files can be added. The rest were left out.`);
  };

  const remove = (fileId: string) => {
    xhrs.current.get(fileId)?.abort();
    xhrs.current.delete(fileId);
    const item = items.find((x) => x.id === fileId);
    setItems((xs) => xs.filter((x) => x.id !== fileId));
    if (item) setAnnounce(`${item.name} removed.`);
  };

  if (!uploadUrl) {
    return (
      <p id={id} className={cn("flex items-start gap-3 rounded-control bg-cream px-5 py-4 text-[15px] leading-relaxed text-ink", className)}>
        <Lock aria-hidden className="mt-0.5 size-[18px] shrink-0 text-marigold-ink" strokeWidth={2.25} />
        {unavailableText}
      </p>
    );
  }

  const full = items.filter((x) => x.status !== "error").length >= maxFiles;
  return (
    <div className={className}>
      <label
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled && !full) setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          if (!disabled && !full && e.dataTransfer.files.length) void add(e.dataTransfer.files);
        }}
        className={cn(
          "group flex cursor-pointer flex-col items-center rounded-card border-2 border-dashed p-8 text-center transition-colors duration-300",
          over ? "border-forest bg-mint/40" : invalid ? "border-coral-800 bg-coral-100/40" : "border-edge bg-cream-2 hover:border-forest",
          "has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-offset-[3px] has-[:focus-visible]:outline-[color:var(--focus,var(--color-forest))]",
          (disabled || full) && "cursor-not-allowed opacity-60",
        )}
      >
        <input
          id={id}
          type="file"
          multiple={maxFiles > 1}
          accept={accept}
          disabled={disabled || full}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          className="sr-only"
          onChange={(e) => {
            if (e.target.files?.length) void add(e.target.files);
            e.target.value = "";
          }}
        />
        <span className={cn(over && "animate-[pi-pop_0.8s_var(--ease-out-back)] motion-reduce:animate-none")}>
          <IconDisc icon={Upload} size={52} halo="marigold" />
        </span>
        <span className="mt-4 text-[16px] font-bold text-ink">
          Drop files here or <span className="text-forest underline decoration-marigold decoration-2 underline-offset-4 md:hidden">choose from your phone</span>
          <span className="hidden text-forest underline decoration-marigold decoration-2 underline-offset-4 md:inline">choose a file</span>
        </span>
        <span className="mt-1.5 font-grotesk text-[13px] text-body">
          {describeAccept(accept)} · up to {maxSizeMb} MB each · {maxFiles} {maxFiles === 1 ? "file" : "files"} at most
        </span>
        {hint ? <span className="mt-2 text-[14px] text-body">{hint}</span> : null}
        {sensitive ? (
          <span className="mt-3 inline-flex items-center gap-1.5 text-[14px] font-semibold text-forest">
            <Lock aria-hidden className="size-4" strokeWidth={2.5} /> Only the officer handling your request can open these files.
          </span>
        ) : null}
      </label>

      {items.length ? (
        <ul className="mt-4 grid gap-2.5">
          {items.map((it) => (
            <li key={it.id} className="rounded-tile bg-white px-4 py-3 shadow-soft">
              <div className="flex items-center gap-3">
                {IMAGE_TYPES.includes(it.type) ? (
                  <ImageIcon aria-hidden className="size-5 shrink-0 text-forest" strokeWidth={2} />
                ) : (
                  <FileText aria-hidden className="size-5 shrink-0 text-forest" strokeWidth={2} />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold text-ink">{it.name}</span>
                  <span className="block font-grotesk text-[12.5px] tabular-nums text-body">
                    {formatBytes(it.size)}
                    {it.status === "preparing" ? " · getting it ready…" : it.status === "uploading" ? ` · ${it.progress}%` : it.status === "done" ? " · uploaded" : ""}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => remove(it.id)}
                  aria-label={`Remove ${it.name}`}
                  className="grid size-11 shrink-0 place-items-center rounded-full text-ink transition-colors hover:bg-ink/[0.06]"
                >
                  <X aria-hidden className="size-[18px]" strokeWidth={2.5} />
                </button>
              </div>
              {it.status === "uploading" || it.status === "preparing" ? (
                <ProgressBar percent={it.progress} tone="forest" animate={false} label={`Uploading ${it.name}`} className="mt-2.5" />
              ) : null}
              {it.status === "error" && it.error ? (
                <p className="mt-2 flex items-start gap-1.5 text-[14px] font-semibold text-coral-800">
                  <AlertCircle aria-hidden className="mt-0.5 size-4 shrink-0" strokeWidth={2.5} />
                  {it.error}
                </p>
              ) : null}
              {it.status === "done" && it.token ? <input type="hidden" name={name} value={it.token} /> : null}
            </li>
          ))}
        </ul>
      ) : null}
      <p aria-live="polite" className="sr-only">
        {announce}
      </p>
    </div>
  );
}
