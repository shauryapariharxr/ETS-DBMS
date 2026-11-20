import Link from "next/link";
import { Footer, Header } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header session={null} />
      <main className="mx-auto flex w-full max-w-6xl flex-1 items-center px-4 py-24 sm:px-6">
        <div className="max-w-lg">
          <p className="mono-label">404</p>
          <h1 className="mt-4 font-display text-3xl font-semibold tracking-tight">
            This page isn&apos;t on the bill
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
            The event may have ended, been cancelled or never existed. Head back to the catalogue to
            find something else.
          </p>
          <Link href="/" className="btn-primary mt-8">
            Browse events
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}
