import { Nav } from "./Nav";

export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Nav />
      <main className="relative mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:py-10">
        <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
          <div className="absolute left-1/2 top-0 h-72 w-72 -translate-x-1/2 rounded-full bg-cyan-400/15 blur-3xl" />
          <div className="absolute bottom-12 right-8 h-80 w-80 rounded-full bg-violet-500/10 blur-3xl" />
        </div>
        {children}
      </main>
    </>
  );
}
