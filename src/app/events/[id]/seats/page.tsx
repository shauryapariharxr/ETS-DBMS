import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getEvent } from "@/lib/queries";
import SeatPicker from "@/components/SeatPicker";
import { Header } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function SeatSelectionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const eventId = Number(id);
  const session = await getSessionUser();
  if (!session) redirect(`/login?next=/events/${id}/seats`);
  const event = await getEvent(eventId);
  if (!event) redirect("/");

  return (
    <div className="flex min-h-screen flex-col">
      <Header session={session} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
        <SeatPicker
          eventId={eventId}
          eventTitle={event.title}
          venueName={`${event.venue_name}, ${event.city}`}
          tiers={event.tiers.map((t) => ({ name: t.name, base_price: Number(t.base_price), tax_rate: Number(t.tax_rate), fee_amount: Number(t.fee_amount) }))}
        />
      </main>
      {/* Checkout step: keep the site chrome out of the way while seats are picked. */}
      <div className="border-t border-line/70 py-5 text-center text-[12px] text-ink-soft">
        Secure checkout · StagePass · Seats are held for 10 minutes
      </div>
    </div>
  );
}
