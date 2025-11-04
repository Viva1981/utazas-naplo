"use client";
import { useState } from "react";

const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

export default function ImageUploader({
  onUploaded,
  uploadEndpoint = "/api/upload", // hagyd így, ha már működik nálad
}: {
  onUploaded?: (data: any) => void;
  uploadEndpoint?: string;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setError(null);
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : null);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!file) {
      setError("Válassz ki egy képfájlt a feltöltéshez.");
      return;
    }
    if (file.size > MAX_SIZE) {
      setError("A fájl túl nagy (max. 5MB).");
      return;
    }
    if (!ALLOWED.includes(file.type)) {
      setError("Nem támogatott fájltípus (jpg, png, webp, heic/heif).");
      return;
    }

    setIsUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(uploadEndpoint, { method: "POST", body: fd });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      onUploaded?.(data);
      // siker: töröljük a választást
      setFile(null);
      setPreview(null);
      setError(null);
    } catch (err: any) {
      setError(err?.message || "Ismeretlen hiba történt feltöltés közben.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <form onSubmit={onSubmit}>
      <input
        type="file"
        accept="image/*"
        onChange={onChange}
        aria-label="Kép kiválasztása"
      />

      {preview && (
        <div
          style={{
            width: "100%",
            aspectRatio: "4 / 3",
            overflow: "hidden",
            borderRadius: 12,
            marginTop: 8,
          }}
        >
          <img
            src={preview}
            alt="Feltöltendő kép előnézet"
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        </div>
      )}

      {error && (
        <p role="alert" aria-live="polite" style={{ color: "crimson", marginTop: 8 }}>
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={!file || isUploading}
        style={{ marginTop: 8 }}
        aria-busy={isUploading}
      >
        {isUploading ? "Feltöltés..." : "Feltöltés"}
      </button>
    </form>
  );
}
