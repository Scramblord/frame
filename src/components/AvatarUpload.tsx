"use client";

import { supabase } from "@/lib/supabase/client";
import { useCallback, useEffect, useRef, useState } from "react";

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_DIMENSION = 400;
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

type AvatarUploadProps = {
  userId: string;
  currentAvatarUrl: string | null;
  currentInitials: string | null;
  onUploadComplete: (newUrl: string) => void;
};

function extForMime(mime: string): string {
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "jpg";
}

async function resizeImageToMax(
  file: File,
  maxPx: number,
): Promise<{ blob: Blob; contentType: string }> {
  const contentType = file.type;
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      try {
        const w = img.naturalWidth;
        const h = img.naturalHeight;
        const scale = Math.min(maxPx / w, maxPx / h, 1);
        const cw = Math.round(w * scale);
        const ch = Math.round(h * scale);
        const canvas = document.createElement("canvas");
        canvas.width = cw;
        canvas.height = ch;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Could not process this image."));
          return;
        }
        ctx.drawImage(img, 0, 0, cw, ch);
        const quality = contentType === "image/jpeg" ? 0.92 : undefined;
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error("Could not encode this image."));
              return;
            }
            resolve({ blob, contentType });
          },
          contentType,
          quality,
        );
      } catch (e) {
        reject(e instanceof Error ? e : new Error("Could not process this image."));
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Could not load this image."));
    };
    img.src = objectUrl;
  });
}

function Spinner() {
  return (
    <span
      className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-white/30 border-t-white"
      aria-hidden
    />
  );
}

export default function AvatarUpload({
  userId,
  currentAvatarUrl,
  currentInitials,
  onUploadComplete,
}: AvatarUploadProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    if (!showSuccess) return;
    const t = window.setTimeout(() => setShowSuccess(false), 2000);
    return () => window.clearTimeout(t);
  }, [showSuccess]);

  const openPicker = useCallback(() => {
    if (uploading) return;
    fileInputRef.current?.click();
  }, [uploading]);

  const onFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;

      setError(null);
      setShowSuccess(false);
      if (file.size > MAX_FILE_BYTES) {
        setError("File is too large. Maximum size is 5MB.");
        return;
      }
      if (!ALLOWED_MIME.has(file.type)) {
        setError("Please choose a JPG, PNG, or WebP image.");
        return;
      }

      setUploading(true);
      try {
        const { blob, contentType } = await resizeImageToMax(file, MAX_DIMENSION);
        const ext = extForMime(contentType);
        const objectPath = `${userId}/${Date.now()}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from("avatars")
          .upload(objectPath, blob, {
            contentType,
            upsert: false,
          });

        if (uploadError) {
          setError(uploadError.message || "Upload failed.");
          return;
        }

        const { data: publicData } = supabase.storage.from("avatars").getPublicUrl(objectPath);
        const publicUrl = publicData.publicUrl;

        const { error: dbError } = await supabase
          .from("profiles")
          .update({ avatar_url: publicUrl })
          .eq("user_id", userId);

        if (dbError) {
          setError(dbError.message || "Could not save your profile photo.");
          return;
        }

        onUploadComplete(publicUrl);
        setShowSuccess(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      } finally {
        setUploading(false);
      }
    },
    [onUploadComplete, userId],
  );

  const showImage = Boolean(currentAvatarUrl);
  const initials = currentInitials?.trim() || "?";

  return (
    <div className="flex flex-col items-start gap-2">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
        className="sr-only"
        onChange={onFileChange}
        tabIndex={-1}
        aria-hidden
      />
      <button
        type="button"
        onClick={openPicker}
        disabled={uploading}
        aria-busy={uploading}
        aria-label="Upload profile photo"
        className="relative h-24 w-24 shrink-0 overflow-hidden rounded-full border-2 border-[var(--color-border)] bg-zinc-100 text-left shadow-[var(--shadow-sm)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 disabled:cursor-wait"
      >
        {showImage ? (
          <img
            src={currentAvatarUrl!}
            alt=""
            className="h-full w-full object-cover"
            width={96}
            height={96}
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center bg-zinc-900 text-xl font-bold text-white">
            {initials}
          </span>
        )}

        {uploading ? (
          <span className="absolute inset-0 flex items-center justify-center bg-black/50">
            <Spinner />
          </span>
        ) : null}

        {showSuccess && !uploading ? (
          <span className="absolute inset-0 flex items-center justify-center bg-emerald-600/90">
            <svg
              className="h-10 w-10 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
              aria-hidden
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </span>
        ) : null}
      </button>

      <p className="text-xs text-[var(--color-text-muted)]">
        JPG, PNG, or WebP · max 5MB · click to change
      </p>

      {error ? (
        <p className="text-sm font-medium text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
