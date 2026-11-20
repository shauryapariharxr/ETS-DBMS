import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { Footer, Header } from "@/components/ui";

export interface LegalSection {
  heading: string;
  body: string[];
  id?: string;
}

/**
 * Shared layout for the policy pages: brand chrome, page title, numbered
 * sections and a footer. Content is passed in by each page.
 */
export async function LegalPage({
  eyebrow,
  title,
  summary,
  sections,
  updated = "20 November 2026",
}: {
  eyebrow: string;
  title: string;
  summary: string;
  sections: LegalSection[];
  updated?: string;
}) {
  const session = await getSessionUser();

  return (
    <div className="flex min-h-screen flex-col">
      <Header session={session} />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-4 sm:px-6">
        <div className="mt-6 max-w-2xl">
          <p className="mono-label">{eyebrow}</p>
          <h1 className="mt-4 font-display text-3xl font-semibold tracking-tight sm:text-[38px]">
            {title}
          </h1>
          <p className="mt-4 text-[14.5px] leading-relaxed text-ink-soft">{summary}</p>
          <p className="mt-4 text-xs text-ink-soft/80">Last updated: {updated}</p>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-[220px_1fr]">
          <aside className="hidden lg:block">
            <div className="sticky top-28 rounded-2xl border border-line bg-surface/60 p-5">
              <p className="mono-label">On this page</p>
              <ul className="mt-4 space-y-2.5 text-[13px] text-ink-soft">
                {sections.map((section, i) => (
                  <li key={section.heading} className="flex gap-2">
                    <span className="tnum text-ink-soft/60">{String(i + 1).padStart(2, "0")}</span>
                    <a href={section.id ? `#${section.id}` : `#s${i + 1}`} className="hover:text-ink">
                      {section.heading}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </aside>

          <article className="card p-6 sm:p-9">
            <div className="space-y-9">
              {sections.map((section, i) => (
                <section key={section.heading} id={section.id ?? `s${i + 1}`} className="scroll-mt-28">
                  <div className="flex items-baseline gap-3">
                    <span className="mono-label text-ink-blue">{String(i + 1).padStart(2, "0")}</span>
                    <h2 className="font-display text-[17px] font-semibold text-ink">
                      {section.heading}
                    </h2>
                  </div>
                  <div className="mt-3 space-y-3 text-[14px] leading-relaxed text-ink-soft">
                    {section.body.map((paragraph) => (
                      <p key={paragraph}>{paragraph}</p>
                    ))}
                  </div>
                </section>
              ))}
            </div>

            <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-line/70 pt-6 text-[13px] text-ink-soft">
              <span>Questions about this page?</span>
              <Link href="/contact" className="btn-ghost btn-sm">
                Contact support
              </Link>
            </div>
          </article>
        </div>
      </main>

      <Footer />
    </div>
  );
}
