export default function HomePage() {
  const cards = [
    {
      title: "Utak",
      desc: "Böngészd a már rögzített utazásokat.",
      href: "/trips",
      emoji: "🧭",
    },
  ];

  return (
    <main className="max-w-5xl mx-auto px-4 py-4 md:py-8">
      <section className="mb-6">
        <h1 className="text-2xl md:text-3xl font-semibold">Utazás Napló</h1>
        <p className="text-gray-600 mt-1">
          Gyors, mobilbarát felület – kártyák, alsó tab, letisztult nézet.
        </p>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {cards.map((c) => (
          <a
            key={c.title}
            href={c.href}
            className="
              group border rounded-2xl p-4 md:p-5
              bg-white/80 backdrop-blur-sm hover:bg-white
              shadow-sm hover:shadow-md transition
              focus:outline-none focus:ring-2 focus:ring-gray-300
            "
          >
            <div className="text-2xl mb-2">{c.emoji}</div>
            <h2 className="text-lg font-semibold">{c.title}</h2>
            <p className="text-sm text-gray-600 mt-1">{c.desc}</p>
          </a>
        ))}
      </section>
    </main>
  );
}
