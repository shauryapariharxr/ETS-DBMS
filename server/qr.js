import crypto from "node:crypto";
import QRCode from "qrcode";

/** Opaque single-use ticket QR payload (business rule 6). */
export function generateQrCode() {
  return `sp_${crypto.randomBytes(16).toString("hex")}`;
}

export function generateTicketNumber() {
  const stamp = Date.now().toString(36).toUpperCase();
  const rand = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `TCK-${stamp}-${rand}`;
}

export function qrDataUrl(text) {
  return QRCode.toDataURL(text, {
    width: 240,
    margin: 1,
    color: { dark: "#1F2A33", light: "#FFFFFF" },
  });
}
