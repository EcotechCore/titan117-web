// Phase 0: an empty web app that proves the repo builds. The homepage from
// homepage-grid/ moves in during phase 2 (architecture §4).
export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-2 p-4 text-center">
      <h1 className="text-2xl font-semibold">Titan117</h1>
      <p className="text-zinc-500">Your AI team, on your own laptop. Coming soon.</p>
    </main>
  );
}
