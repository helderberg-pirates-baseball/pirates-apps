// The treasurer's to-do list: what still needs doing with invoices, payments
// and damage deposits. Cancelled and declined bookings only show when they
// paid something that hasn't been settled yet.
import { currentInvoice, invoiceTotal, type Invoice } from "./invoices";
import {
  amountOverpaid,
  amountReceived,
  paymentsFor,
  type Payment,
} from "./payments";
import { isCalledOff, type TrackedBooking } from "./tracking";

export interface TodoItem {
  booking: TrackedBooking;
  /** The booking's current invoice, if it has one */
  invoice: Invoice | undefined;
  /** The invoice's total in rand, or 0 without one */
  total: number;
  /** Rand received so far */
  received: number;
  /**
   * Rand still owed for this step: the deposit or the rest to come in, or
   * an overpayment for the club to pay back
   */
  owing: number;
}

export interface PaymentsTodo {
  /** Coming up, with no invoice yet */
  needsInvoice: TodoItem[];
  /**
   * Marked Invoice Sent, but the invoice was made outside the app. Making it
   * in the app, with the same number, puts it on the rest of the list.
   */
  sentOutsideApp: TodoItem[];
  /** The invoice is made but hasn't been sent */
  notSent: TodoItem[];
  /** Sent, and half the invoice hasn't come in yet */
  awaitingDeposit: TodoItem[];
  /** The deposit is in, the rest isn't */
  balanceOwing: TodoItem[];
  /** The function is over and the damage deposit is still held */
  depositToRefund: TodoItem[];
  /** More than the invoice came in, and the difference isn't paid back yet */
  overpaid: TodoItem[];
  /**
   * Cancelled or declined after paying something, and not settled yet. What
   * to pay back is decided case by case, so `owing` is what they paid.
   */
  cancelledToSettle: TodoItem[];
}

// Payment statuses that say some money came in
const PAID_STATUSES = ["Deposit Paid", "Full Payment Received"];

// Soonest function first, so the most overdue and the most urgent are on
// top. Bookings without a date go last.
function bySoonest(a: TodoItem, b: TodoItem): number {
  return (a.booking.date ?? "9999-99-99").localeCompare(
    b.booking.date ?? "9999-99-99"
  );
}

export function paymentsTodo(
  bookings: TrackedBooking[],
  invoices: Invoice[],
  payments: Payment[],
  today: string
): PaymentsTodo {
  const todo: PaymentsTodo = {
    needsInvoice: [],
    sentOutsideApp: [],
    notSent: [],
    awaitingDeposit: [],
    balanceOwing: [],
    depositToRefund: [],
    overpaid: [],
    cancelledToSettle: [],
  };

  for (const booking of bookings) {
    const { tracking } = booking;
    const invoice = currentInvoice(invoices, booking.timestampKey);
    const total = invoice ? invoiceTotal(invoice.lines) : 0;
    const received = amountReceived(
      paymentsFor(payments, booking.timestampKey)
    );
    const item = { booking, invoice, total, received, owing: 0 };
    const isOver = booking.date !== null && booking.date < today;

    // A called-off booking that paid something waits for the treasurer to
    // pay back what's fair. Recording that refund makes it Refunded.
    if (isCalledOff(tracking)) {
      const hasPaid =
        received > 0 || PAID_STATUSES.includes(tracking.paymentStatus);
      if (hasPaid && tracking.paymentStatus !== "Refunded") {
        todo.cancelledToSettle.push({ ...item, owing: received });
      }
      continue;
    }

    // Each booking is at one step of getting paid. Past bookings without an
    // invoice are left out: they're from before the app made invoices. So is
    // one with an invoice number typed in by hand, unless it's still waiting
    // on that invoice.
    if (!invoice) {
      const isPaid = tracking.paymentStatus === "Full Payment Received";
      if (tracking.paymentStatus === "Invoice Sent") {
        todo.sentOutsideApp.push(item);
      } else if (!isOver && !tracking.invoiceNumber && !isPaid) {
        todo.needsInvoice.push(item);
      }
    } else if (invoice.status === "Draft") {
      todo.notSent.push(item);
    } else if (tracking.paymentStatus === "Invoice Sent") {
      todo.awaitingDeposit.push({
        ...item,
        owing: Math.max(0, total / 2 - received),
      });
    } else if (tracking.paymentStatus === "Deposit Paid") {
      todo.balanceOwing.push({ ...item, owing: Math.max(0, total - received) });
    }

    if (isOver && tracking.damageDeposit === "Paid") {
      todo.depositToRefund.push(item);
    }

    const overpaid = amountOverpaid(received, total);
    if (overpaid > 0) {
      todo.overpaid.push({ ...item, owing: overpaid });
    }
  }

  for (const items of Object.values(todo)) {
    items.sort(bySoonest);
  }
  return todo;
}

/** Rand still owed across a section */
export function totalOwing(items: TodoItem[]): number {
  return items.reduce((total, item) => total + item.owing, 0);
}
