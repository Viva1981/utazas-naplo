"use client";

type TripDocument = {
  id: string;
  trip_id: string;
  owner_user_id: string;
  filename: string;
  url: string;
  mime: string;
  visibility: "public" | "private";
  created_at: string;
};

export default function DocumentCard({ doc }: { doc: TripDocument }) {
  const isImage = doc.mime.startsWith("image/");
  const isPdf = doc.mime === "application/pdf";

  return (
    <article
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        padding: 12,
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
      aria-label={`Dokumentum: ${doc.filename}`}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <strong style={{ fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {doc.filename}
        </strong>
        <span
          style={{
            fontSize: 12,
            padding: "2px 8px",
            borderRadius: 999,
            border: "1px solid #e5e7eb",
          }}
          aria-label={`Láthatóság: ${doc.visibility === "private" ? "Privát" : "Publikus"}`}
          title={doc.visibility === "private" ? "Privát" : "Publikus"}
        >
          {doc.visibility === "private" ? "Privát" : "Publikus"}
        </span>
      </div>

      {/* Előnézet */}
      <div style={{ width: "100%", aspectRatio: "4 / 3", overflow: "hidden", borderRadius: 8 }}>
        {isImage ? (
          <img
            src={doc.url}
            alt={doc.filename}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
            loading="lazy"
          />
        ) : isPdf ? (
          // PDF: egyszerű beágyazás vagy ikon + link; itt basic embed
          <iframe
            src={doc.url}
            title={doc.filename}
            style={{ width: "100%", height: "100%", border: 0 }}
          />
        ) : (
          // Egyéb: ikon + link megnyitás új lapon
          <a
            href={doc.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              textDecoration: "none",
            }}
            aria-label={`${doc.filename} megnyitása új lapon`}
          >
            📄 Megnyitás
          </a>
        )}
      </div>

      <a
        href={doc.url}
        target="_blank"
        rel="noopener noreferrer"
        style={{ fontSize: 14, textDecoration: "underline" }}
      >
        Letöltés / megnyitás
      </a>
    </article>
  );
}
