// Egyszerű placeholder adattípusok
export type Trip = {
  id: string;
  title: string;
  owner_user_id: string;
  visibility?: "public" | "private";
};

export type TripDocument = {
  id: string;
  trip_id: string;
  owner_user_id: string;
  filename: string;
  url: string;      // valamilyen publikus/korlátozott URL
  mime: string;     // pl. "image/jpeg", "application/pdf"
  visibility: "public" | "private";
  created_at: string;
};

// TODO: Ezeket kösd rá a tényleges adatforrásodra.
// Most ideiglenesen “mock” implementáció:
export async function getTripById(tripId: string): Promise<Trip | null> {
  // Itt valós környezetben adatbázis / Sheets / Drive meta lekérés
  // VAGY hozd át a meglévő függvényedet és töröld ezt a mockot.
  return {
    id: tripId,
    title: "Demo trip",
    owner_user_id: "USER_1", // ezt a GET routeban a sessionhöz igazítjuk
    visibility: "public",
  };
}

export async function getDocumentsByTripId(tripId: string): Promise<TripDocument[]> {
  // Itt valós környezetben a doksik metaadatát kérd le
  // Most csak példa adatok:
  return [
    {
      id: "doc_1",
      trip_id: tripId,
      owner_user_id: "USER_1",
      filename: "WizzAir-boarding-pass.pdf",
      url: "https://example.com/doc1.pdf",
      mime: "application/pdf",
      visibility: "private",
      created_at: new Date().toISOString(),
    },
    {
      id: "doc_2",
      trip_id: tripId,
      owner_user_id: "USER_1",
      filename: "Hotel-confirmation.png",
      url: "https://example.com/hotel.png",
      mime: "image/png",
      visibility: "public",
      created_at: new Date().toISOString(),
    },
  ];
}
