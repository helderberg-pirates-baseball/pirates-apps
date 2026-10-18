// What recording a payment does to a booking's payment status and damage
// deposit. The record-payment page shows this as a suggestion while the
// treasurer fills it in, and they can change it before saving, so this file
// runs in the browser too: it imports nothing the browser can't load.
import type { PaymentKind } from "./payments";

// The payment statuses on the way to being paid, in order. Refunded isn't
// one of them.
const PAYMENT_PROGRESS = [
  "None",
  "Invoice Sent",
  "Deposit Paid",
  "Full Payment Received",
];

/**
 * The payment status once this much of the invoice is in: Deposit Paid from
 * half, Full Payment Received from all of it. It only ever moves forward,
 * and leaves Refunded alone.
 */
export function paymentStatusAfterPayment(
  current: string,
  received: number,
  invoiceTotal: number
): string {
  const currentStep = PAYMENT_PROGRESS.indexOf(current);
  if (invoiceTotal <= 0 || currentStep === -1) {
    return current;
  }
  let reached = current;
  if (received >= invoiceTotal) {
    reached = "Full Payment Received";
  } else if (received >= invoiceTotal / 2) {
    reached = "Deposit Paid";
  }
  return PAYMENT_PROGRESS.indexOf(reached) > currentStep ? reached : current;
}

/** The damage deposit is part of the invoice, so it's Paid once the whole invoice is */
export function damageDepositAfterPayment(
  current: string,
  received: number,
  invoiceTotal: number
): string {
  const isFullyPaid = invoiceTotal > 0 && received >= invoiceTotal;
  return isFullyPaid && current === "Outstanding" ? "Paid" : current;
}

export interface Statuses {
  paymentStatus: string;
  damageDeposit: string;
}

/**
 * The statuses to suggest after recording this payment:
 * - money in moves the payment status forward, and makes the damage
 *   deposit Paid once the whole invoice is in
 * - paying back the damage deposit makes it Refunded
 * - paying back money after a cancellation makes the payment status
 *   Refunded, which settles it
 * - paying back an overpayment changes nothing: it's still paid in full
 */
export function suggestedStatuses(
  current: Statuses,
  kind: PaymentKind,
  amount: number,
  receivedBefore: number,
  invoiceTotal: number
): Statuses {
  if (kind === "Payment") {
    const received = receivedBefore + amount;
    return {
      paymentStatus: paymentStatusAfterPayment(
        current.paymentStatus,
        received,
        invoiceTotal
      ),
      damageDeposit: damageDepositAfterPayment(
        current.damageDeposit,
        received,
        invoiceTotal
      ),
    };
  }
  if (kind === "Damage deposit refund") {
    return { ...current, damageDeposit: "Refunded" };
  }
  if (kind === "Refund") {
    return { ...current, paymentStatus: "Refunded" };
  }
  return current;
}
