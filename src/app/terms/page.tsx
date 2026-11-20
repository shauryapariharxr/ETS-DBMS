import { LegalPage } from "@/components/legal-page";

export const metadata = {
  title: "Terms & Conditions — StagePass",
  description: "The rules for buying, holding and using a StagePass ticket.",
};

export default function TermsPage() {
  return (
    <LegalPage
      eyebrow="Legal"
      title="Terms & Conditions"
      summary="These terms cover your account, ticket purchases, seat holds and entry to events booked through StagePass. By using the platform you agree to them."
      sections={[
        {
          heading: "About these terms",
          body: [
            "StagePass is a seat-level ticketing platform. These terms form an agreement between you and StagePass when you create an account, hold seats or buy a ticket.",
            "Individual events are organised by their respective organisers. The organiser is responsible for the event itself; StagePass is responsible for the booking, payment and ticket-issuing process described here.",
          ],
        },
        {
          heading: "Your account",
          body: [
            "You must provide a valid email address and keep your password private. You are responsible for activity that happens under your account.",
            "One person may hold one customer account. Accounts found to be used for bulk purchasing, resale or automated seat grabbing may be suspended and their holds released.",
          ],
        },
        {
          heading: "Buying tickets",
          body: [
            "A seat is reserved for you when you place a hold. Holds expire after the checkout window shown on the seat map, after which the seat returns to sale automatically.",
            "A purchase is confirmed only when payment succeeds and the ticket appears under My tickets. Prices, taxes and booking fees are locked at the moment of purchase and shown before you pay.",
            "Every ticket carries a unique number and QR code. Duplicated, edited or screenshotted QR codes are rejected at the gate.",
          ],
        },
        {
          heading: "Entry and ticket rules",
          id: "entry",
          body: [
            "Present the QR code from your StagePass account at the gate. Each ticket is valid for a single scan unless the event explicitly allows re-entry.",
            "The venue may refuse entry for invalid tickets, for behaviour that endangers staff or other guests, or where local rules require it. Doors usually open 30 minutes before showtime.",
            "Ticket transfers are only valid when completed inside StagePass. A ticket shared as a screenshot or forwarded email is not a valid transfer.",
          ],
        },
        {
          heading: "Cancellations and changes",
          body: [
            "If an event is cancelled or rescheduled by the organiser, we contact ticket holders by email and apply the refund policy published on this site.",
            "We may correct obvious pricing or listing errors before a purchase is confirmed. If a correction affects an order you already paid for, you will be offered a full refund.",
          ],
        },
        {
          heading: "Acceptable use",
          body: [
            "Do not attempt to disrupt the platform, scrape seat availability at scale, bypass the hold system, or access another customer's account or tickets.",
            "Seat maps, pricing and catalogue data are provided for booking personal tickets only.",
          ],
        },
        {
          heading: "Limitation of liability",
          body: [
            "StagePass is not liable for indirect losses such as travel, accommodation or missed connections. Where liability cannot be excluded, it is limited to the value of the tickets purchased in the affected order.",
          ],
        },
        {
          heading: "Changes to these terms",
          body: [
            "We may update these terms as the platform changes. The date at the top of this page shows the latest revision, and continued use after a change means you accept the updated terms.",
            "For anything unclear, write to support@stagepass.app or use the contact page.",
          ],
        },
      ]}
    />
  );
}
