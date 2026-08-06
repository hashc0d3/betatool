import { BinaryRain } from "./BinaryRain";
import { Nav } from "./Nav";

export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Nav />
      <main className="relative mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:py-10">
        <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[#04150c]">
          <BinaryRain />
        </div>
        {children}
      </main>
    </>
  );
}
