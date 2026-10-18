import { describe, expect, it } from "vitest";
import { parseBookings } from "./bookings";
import {
  RESPONSE_HEADERS,
  RESPONSE_ROWS,
  TRACKING_HEADERS,
  TRACKING_ROWS,
} from "./bookings.fixtures";
import type { Invoice, InvoiceLine } from "./invoices";
import type { Payment } from "./payments";
import { paymentsTodo, totalOwing, type TodoItem } from "./payments-todo";
import {
  parseTrackingTab,
  withTracking,
  type TrackedBooking,
} from "./tracking";

// Jane Someone's and Mary Anyone's functions are on 17 October, John Doe's
// was the day before
const TODAY = "2026-10-17";

const tracked = withTracking(
  parseBookings([RESPONSE_HEADERS, ...RESPONSE_ROWS]),
  parseTrackingTab([TRACKING_HEADERS, ...TRACKING_ROWS])
);
// Djou Ma has been sent an invoice. So has Alex Earlier, whose function is
// over, but on an invoice made outside the app.
const PAYMENT_STATUS_CHANGES: Record<string, string> = {
  "Djou Ma": "Invoice Sent",
  "Alex Earlier": "Invoice Sent",
};
const bookings: TrackedBooking[] = tracked.map((booking) =>
  PAYMENT_STATUS_CHANGES[booking.name]
    ? {
        ...booking,
        tracking: {
          ...booking.tracking,
          paymentStatus: PAYMENT_STATUS_CHANGES[booking.name],
        },
      }
    : booking
);

function keyOf(name: string): string {
  const booking = bookings.find((b) => b.name === name);
  if (!booking) throw new Error(`No booking for ${name}`);
  return booking.timestampKey;
}

const LINES: InvoiceLine[] = [
  { kind: "rental", description: "Club House & Field Rental", amount: 3500 },
  { kind: "deposit", description: "Damage Deposit (Refundable)", amount: 500 },
];

function invoice(name: string, number: string, status: Invoice["status"]) {
  return {
    number,
    bookingKey: keyOf(name),
    issuedOn: "2026-10-01",
    status,
    customer: name,
    address: "",
    regNumber: "",
    phone: "",
    email: "",
    lines: LINES,
    row: 2,
  };
}

const invoices: Invoice[] = [
  invoice("John Doe", "INV-1", "Sent"),
  invoice("Person Sur", "INV-2", "Draft"),
  invoice("Djou Ma", "INV-3", "Sent"),
  invoice("Mary Anyone", "INV-5", "Sent"),
  // Berry Allen cancelled, so that invoice isn't on the list
  invoice("Berry Allen", "INV-4", "Draft"),
];

function payment(name: string, amount: number): Payment {
  return {
    id: name,
    bookingKey: keyOf(name),
    paidOn: "2026-10-05",
    kind: "Payment",
    amount,
    note: "",
    recordedBy: "",
    row: 2,
  };
}

const payments = [
  payment("John Doe", 2000),
  payment("Djou Ma", 500),
  // R500 over Mary Anyone's invoice
  payment("Mary Anyone", 4500),
  // Berry Allen paid before cancelling
  payment("Berry Allen", 2000),
];

const todo = paymentsTodo(bookings, invoices, payments, TODAY);
const names = (items: TodoItem[]) => items.map((item) => item.booking.name);

describe("paymentsTodo", () => {
  it("lists coming bookings without an invoice, soonest first", () => {
    // Mary Anyone has paid in full without one, Berry Allen cancelled, and
    // the past bookings are from before the app made invoices
    expect(names(todo.needsInvoice)).toEqual(["Jane Someone", "Hond Kat"]);
  });

  it("lists invoices that haven't been sent", () => {
    expect(names(todo.notSent)).toEqual(["Person Sur"]);
  });

  it("lists sent invoices waiting for the deposit, with what's still due", () => {
    expect(names(todo.awaitingDeposit)).toEqual(["Djou Ma"]);
    expect(todo.awaitingDeposit[0]).toMatchObject({
      total: 4000,
      received: 500,
      owing: 1500,
    });
  });

  it("lists bookings with the deposit in and the rest still to come", () => {
    expect(names(todo.balanceOwing)).toEqual(["John Doe"]);
    expect(todo.balanceOwing[0]).toMatchObject({ received: 2000, owing: 2000 });
    expect(totalOwing(todo.balanceOwing)).toBe(2000);
  });

  it("lists overpaid invoices, with what's to pay back", () => {
    expect(names(todo.overpaid)).toEqual(["Mary Anyone"]);
    expect(todo.overpaid[0]).toMatchObject({ received: 4500, owing: 500 });
  });

  it("lists damage deposits still held after the function", () => {
    // Sam Past's was refunded already
    expect(names(todo.depositToRefund)).toEqual(["John Doe"]);
  });

  it("lists sent invoices made outside the app, whenever the function is", () => {
    expect(names(todo.sentOutsideApp)).toEqual(["Alex Earlier"]);
  });

  it("lists cancelled bookings that paid something, with what they paid", () => {
    expect(names(todo.cancelledToSettle)).toEqual(["Berry Allen"]);
    expect(todo.cancelledToSettle[0]).toMatchObject({
      received: 2000,
      owing: 2000,
    });
  });

  it("leaves out cancelled bookings once they're refunded", () => {
    const refunded = bookings.map((booking) =>
      booking.name === "Berry Allen"
        ? {
            ...booking,
            tracking: { ...booking.tracking, paymentStatus: "Refunded" },
          }
        : booking
    );
    const settled = paymentsTodo(refunded, invoices, payments, TODAY);
    expect(settled.cancelledToSettle).toEqual([]);
  });
});
