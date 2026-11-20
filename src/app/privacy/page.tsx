import { LegalPage } from "@/components/legal-page";

export const metadata = {
  title: "Privacy Policy — StagePass",
  description: "What StagePass collects, why it is collected and how long it is kept.",
};

export default function PrivacyPage() {
  return (
    <LegalPage
      eyebrow="Legal"
      title="Privacy Policy"
      summary="We collect the minimum needed to sell a ticket, get you through the gate and answer your support questions. This page explains exactly what that means."
      sections={[
        {
          heading: "What we collect",
          body: [
            "Account details: your name, email address and a hashed password. Passwords are stored as bcrypt hashes and are never visible to staff.",
            "Booking details: the events, seats and price tiers you hold or buy, the payment status returned by our payment flow, and the ticket numbers issued to you.",
            "Gate activity: when and where a ticket was scanned, and whether entry was granted or denied. This record protects both you and the organiser against ticket misuse.",
          ],
        },
        {
          heading: "How we use it",
          body: [
            "To hold seats, process orders, issue QR tickets and show your purchases under My tickets.",
            "To validate tickets at the gate, prevent duplicate entry and investigate failed or disputed scans.",
            "To send transactional messages about your bookings. We do not sell your data or use it for third-party advertising.",
          ],
        },
        {
          heading: "Payments",
          body: [
            "Card and UPI details are handled by the payment provider and never reach StagePass servers. We store only the payment method type, amount, tax, fee and the provider reference needed to reconcile the order.",
          ],
        },
        {
          heading: "Cookies",
          body: [
            "We use a single httpOnly session cookie to keep you signed in. It contains a signed session token, is not readable by page scripts and expires after seven days or when you sign out.",
            "Seat holds are tracked on the server, not in browser storage, so clearing cookies does not silently release an active hold.",
          ],
        },
        {
          heading: "Retention",
          body: [
            "Account and booking records are kept while your account is active and for the period required to support refunds, accounting and audit checks.",
            "Scan records are tied to tickets and kept with the event's audit trail. Expired seat holds are removed automatically by the server.",
          ],
        },
        {
          heading: "Your choices",
          body: [
            "You can update your name and password from your account, and ask us to close your account at any time.",
            "You can request a copy of the personal data linked to your account, or correction of anything inaccurate, by writing to support@stagepass.app.",
          ],
        },
        {
          heading: "Contact",
          body: [
            "Privacy questions and data requests: support@stagepass.app. We respond to verified requests within seven working days.",
          ],
        },
      ]}
    />
  );
}
