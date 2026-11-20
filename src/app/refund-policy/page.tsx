import { LegalPage } from "@/components/legal-page";

export const metadata = {
  title: "Refund & Cancellation Policy — StagePass",
  description: "When StagePass tickets can be refunded, cancelled or transferred.",
};

export default function RefundPolicyPage() {
  return (
    <LegalPage
      eyebrow="Legal"
      title="Refund & Cancellation Policy"
      summary="Plans change. This policy explains when a ticket can be refunded, what happens if an event is cancelled, and how seat holds and failed payments are handled."
      sections={[
        {
          heading: "Refund window",
          body: [
            "A confirmed ticket can be refunded up to 48 hours before the event starts. Refunds are issued to the original payment method for the ticket value, including tax and booking fee.",
            "Inside 48 hours of the event, tickets are non-refundable unless the event is cancelled, postponed or materially changed by the organiser.",
            "Refunds are processed within 5–7 working days of approval. Your bank may take a little longer to show the credit.",
          ],
        },
        {
          heading: "Cancelled or postponed events",
          body: [
            "If an organiser cancels an event, every ticket is refunded in full automatically — you do not need to request it.",
            "If an event is postponed, you can keep your ticket for the new date or request a full refund within 7 days of the announcement.",
            "If an event is moved to a different venue or materially shortened, ticket holders are offered a refund on the same terms as a cancellation.",
          ],
        },
        {
          heading: "Seat holds and failed payments",
          body: [
            "A seat hold is not a purchase. Holds expire after the checkout window shown on the seat map and are released automatically, with no charge.",
            "If a payment fails or the checkout session expires, the seat returns to sale and no money is taken. If your bank shows a temporary authorisation, it is released by the bank, usually within 24 hours.",
          ],
        },
        {
          heading: "Ticket transfers",
          body: [
            "Active tickets can be transferred to another StagePass account from My tickets. Once a transfer is accepted, the original buyer can no longer use, refund or resell that ticket.",
            "Tickets shared outside StagePass — screenshots, forwarded emails, resale listings — are not valid and cannot be refunded.",
          ],
        },
        {
          heading: "Requesting a refund",
          id: "request",
          body: [
            "Open My tickets, select the order and use Request a refund, or write to support@stagepass.app with your ticket number and the email on your account.",
            "Include the reason for the request. Approved refunds are recorded against the original payment so you can trace them in your statement.",
          ],
        },
        {
          heading: "Non-refundable situations",
          body: [
            "Late arrival after the event has started, refusal of entry for breaching venue rules, or loss of a ticket QR code are not grounds for a refund.",
            "Booking fees are refunded together with the ticket value except where an event's listing states otherwise before purchase.",
          ],
        },
      ]}
    />
  );
}
