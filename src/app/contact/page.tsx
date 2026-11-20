import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { Footer, Header } from "@/components/ui";

export const metadata = {
  title: "Contact — StagePass",
  description: "Get help with a booking, a refund or gate entry.",
};

const CHANNELS = [
  {
    title: "Booking help",
    body: "Seat holds, checkout issues, missing tickets or a QR code that will not load.",
    action: "support@stagepass.app",
    href: "mailto:support@stagepass.app",
    meta: "Replies within one working day",
  },
  {
    title: "Refunds",
    body: "Cancelled events, postponements or a change of plans inside the refund window.",
    action: "Read the refund policy",
    href: "/refund-policy",
    meta: "5–7 working days to process",
  },
  {
    title: "Gate & entry",
    body: "Ticket not scanning, re-entry questions or access requirements at the venue.",
    action: "Entry rules",
    href: "/terms#entry",
    meta: "Staff at the gate can look up your order",
  },
];

const FAQ = [
  {
    q: "My seats disappeared while I was paying. Why?",
    a: "Seats are held for a limited window. If checkout takes longer than that, the hold expires and the seats return to sale. Nothing is charged unless a payment succeeded and the ticket shows under My tickets.",
  },
  {
    q: "Where is my QR ticket?",
    a: "Sign in and open My tickets. Every active ticket shows its QR code, seat and ticket number. You can also transfer it to another StagePass account from the same page.",
  },
  {
    q: "Can I change the name on a ticket?",
    a: "Yes — transfer the ticket to the other person's StagePass account. Editing a screenshot or forwarding the email will not work at the gate.",
  },
  {
    q: "I am organising an event. How do I list it?",
    a: "Organiser and admin accounts create venues, seat layouts and events from the admin console. Write to support@stagepass.app with your event details to get an organiser account.",
  },
];

export default async function ContactPage() {
  const session = await getSessionUser();

  return (
    <div className="flex min-h-screen flex-col">
      <Header session={session} />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-4 sm:px-6">
        <div className="mt-6 max-w-2xl">
          <p className="mono-label">Support</p>
          <h1 className="mt-4 font-display text-3xl font-semibold tracking-tight sm:text-[38px]">
            Contact us
          </h1>
          <p className="mt-4 text-[14.5px] leading-relaxed text-ink-soft">
            Tell us the ticket number and the email on your account and we can look at the order
            directly. Most booking problems are solved the same day.
          </p>
        </div>

        <div className="mt-10 grid gap-5 sm:grid-cols-3">
          {CHANNELS.map((channel) => (
            <div key={channel.title} className="card flex flex-col p-6">
              <h2 className="font-display text-[15px] font-semibold text-ink">{channel.title}</h2>
              <p className="mt-2 flex-1 text-[13px] leading-relaxed text-ink-soft">
                {channel.body}
              </p>
              <Link
                href={channel.href}
                className="mt-5 inline-flex items-center gap-2 text-[13px] font-medium text-ink-blue transition-colors hover:text-ink"
              >
                {channel.action}
                <span aria-hidden>→</span>
              </Link>
              <p className="mt-2 text-[11.5px] text-ink-soft/80">{channel.meta}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <section className="card p-6 sm:p-8">
            <p className="mono-label">FAQ</p>
            <h2 className="mt-2.5 font-display text-lg font-semibold">Common questions</h2>

            <div className="mt-5 divide-y divide-line/70">
              {FAQ.map((item) => (
                <details key={item.q} className="group py-4">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[14px] font-medium text-ink">
                    {item.q}
                    <span
                      aria-hidden
                      className="text-ink-soft transition-transform duration-200 group-open:rotate-45"
                    >
                      +
                    </span>
                  </summary>
                  <p className="mt-2.5 text-[13.5px] leading-relaxed text-ink-soft">{item.a}</p>
                </details>
              ))}
            </div>
          </section>

          <aside className="card h-fit p-6 sm:p-8">
            <p className="mono-label">Direct</p>
            <h2 className="mt-2.5 font-display text-lg font-semibold">Reach the team</h2>
            <dl className="mt-5 space-y-4 text-[13px]">
              <div>
                <dt className="text-ink-soft">Email</dt>
                <dd className="mt-1">
                  <a href="mailto:support@stagepass.app" className="text-ink hover:text-ink-blue">
                    support@stagepass.app
                  </a>
                </dd>
              </div>
              <div>
                <dt className="text-ink-soft">Support hours</dt>
                <dd className="mt-1 text-ink">Mon–Sat, 10:00–19:00 IST</dd>
              </div>
              <div>
                <dt className="text-ink-soft">Response time</dt>
                <dd className="mt-1 text-ink">Within one working day</dd>
              </div>
            </dl>

            <div className="mt-6 border-t border-line/70 pt-5">
              <p className="text-[13px] leading-relaxed text-ink-soft">
                Already have a ticket? Open it from{" "}
                <Link href="/tickets" className="text-ink-blue hover:underline">
                  My tickets
                </Link>{" "}
                to see the QR code, transfer or request a refund.
              </p>
            </div>
          </aside>
        </div>
      </main>

      <Footer />
    </div>
  );
}
