// Money received for a booking, and money paid back, in the "Payments" tab.
// The app owns the tab and adds a row per payment.
//
// Paying back money or an overpayment takes it off what was received. What
// a payment does to the booking's statuses is in payment-statuses.ts.
import { timestampKey } from "./bookings";
import { dateFromSerial, serialFromDate, shortDate } from "./dates";
import { formatRand } from "./invoices";

export const PAYMENTS_TAB = "Payments";

export const PAYMENT_KINDS = [
  "Payment",
  "Damage deposit refund",
  "Refund",
  "Overpayment refund",
] as const;
export type PaymentKind = (typeof PAYMENT_KINDS)[number];

/** How each kind is named on screen */
export const PAYMENT_KIND_LABELS: Record<PaymentKind, string> = {
  Payment: "Payment received",
  "Damage deposit refund": "Damage deposit paid back",
  Refund: "Money paid back",
  "Overpayment refund": "Overpayment paid back",
};

export interface Payment {
  id: string;
  /** The booking's timestamp */
  bookingKey: string;
  /** "2026-10-13": when the money went in or out */
  paidOn: string;
  kind: PaymentKind;
  /** Rand, always positive: the kind says which way the money went */
  amount: number;
  /** A bank reference or anything else worth knowing */
  note: string;
  /** The email address of whoever recorded it */
  recordedBy: string;
  /** Its row in the tab (1 is the header row) */
  row: number;
}

export const PAYMENT_COLUMNS = {
  id: "App_Id",
  timestamp: "App_Timestamp",
  paidOn: "App_PaidOn",
  kind: "App_Kind",
  amount: "App_Amount",
  note: "App_Note",
  recordedBy: "App_RecordedBy",
  recordedAt: "App_RecordedAt",
} as const;

export type PaymentColumn = keyof typeof PAYMENT_COLUMNS;

export interface PaymentsTab {
  columns: Record<PaymentColumn, number>;
  payments: Payment[];
}

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function parseKind(value: unknown): PaymentKind {
  const kind = text(value);
  return (PAYMENT_KINDS as readonly string[]).includes(kind)
    ? (kind as PaymentKind)
    : "Payment";
}

/** Reads the "Payments" tab's rows (header row first). Rows without an ID are skipped. */
export function parsePaymentsTab(rows: unknown[][]): PaymentsTab {
  const [headerRow = [], ...dataRows] = rows;
  const headers = headerRow.map((header) => text(header).toLowerCase());

  const columns = {} as Record<PaymentColumn, number>;
  for (const [column, header] of Object.entries(PAYMENT_COLUMNS) as [
    PaymentColumn,
    string,
  ][]) {
    columns[column] = headers.indexOf(header.toLowerCase());
    if (columns[column] === -1) {
      throw new Error(`The "${PAYMENTS_TAB}" tab has no "${header}" column`);
    }
  }

  const payments: Payment[] = [];
  dataRows.forEach((row, index) => {
    const id = text(row[columns.id]);
    if (!id) {
      return;
    }
    const paidOn = row[columns.paidOn];
    const amount = Number(row[columns.amount]);
    payments.push({
      id,
      bookingKey: timestampKey(row[columns.timestamp]),
      paidOn: typeof paidOn === "number" ? dateFromSerial(paidOn) : "",
      kind: parseKind(row[columns.kind]),
      amount: Number.isFinite(amount) ? amount : 0,
      note: text(row[columns.note]),
      recordedBy: text(row[columns.recordedBy]),
      row: index + 2,
    });
  });
  return { columns, payments };
}

/** A booking's payments, oldest first */
export function paymentsFor(
  payments: Payment[],
  bookingKey: string
): Payment[] {
  return payments
    .filter((payment) => payment.bookingKey === bookingKey)
    .sort((a, b) => a.paidOn.localeCompare(b.paidOn));
}

function totalOf(payments: Payment[], kind: PaymentKind): number {
  return payments
    .filter((payment) => payment.kind === kind)
    .reduce((total, payment) => total + payment.amount, 0);
}

/**
 * Rand received towards the invoice: what came in, less any money or
 * overpayment paid back. Paying back the damage deposit doesn't change it:
 * the invoice was still paid.
 */
export function amountReceived(payments: Payment[]): number {
  return (
    totalOf(payments, "Payment") -
    totalOf(payments, "Refund") -
    totalOf(payments, "Overpayment refund")
  );
}

/** Rand received over the invoice total, still to be paid back */
export function amountOverpaid(received: number, invoiceTotal: number): number {
  return invoiceTotal > 0 ? Math.max(0, received - invoiceTotal) : 0;
}

export interface PaymentProgress {
  /** How far along the invoice is: half confirms the booking */
  stage: "Waiting for deposit" | "Deposit paid" | "Paid in full";
  /** Rand still to come, never below 0 */
  toCome: number;
  /** Rand received over the invoice total, still to be paid back */
  overpaid: number;
  /** How much of the invoice is in, from 0 to 100 */
  percent: number;
}

/** Where an invoice stands, for showing it at a glance */
export function paymentProgress(
  invoiceTotal: number,
  received: number
): PaymentProgress {
  let stage: PaymentProgress["stage"] = "Waiting for deposit";
  if (received >= invoiceTotal) {
    stage = "Paid in full";
  } else if (received >= invoiceTotal / 2) {
    stage = "Deposit paid";
  }
  const percent =
    invoiceTotal > 0 ? Math.min(100, (received / invoiceTotal) * 100) : 100;
  return {
    stage,
    toCome: Math.max(0, invoiceTotal - received),
    overpaid: amountOverpaid(received, invoiceTotal),
    percent,
  };
}

export interface Settlement {
  /**
   * Settled once the payment status is Refunded: whatever was fair has been
   * paid back
   */
  stage: "To settle" | "Settled" | "Nothing paid";
  /** Rand that came in */
  paidIn: number;
  /** Rand paid back, of any kind */
  paidBack: number;
  /** Rand the club keeps */
  kept: number;
}

/**
 * Where a cancelled or declined booking's money stands. Nothing more is
 * coming in, so it's what came in against what went back.
 */
export function settlement(
  payments: Payment[],
  paymentStatus: string
): Settlement {
  const paidIn = totalOf(payments, "Payment");
  const paidBack = payments
    .filter((payment) => payment.kind !== "Payment")
    .reduce((total, payment) => total + payment.amount, 0);
  const statusSaysPaid =
    paymentStatus === "Deposit Paid" ||
    paymentStatus === "Full Payment Received";

  let stage: Settlement["stage"] = "Nothing paid";
  if (paymentStatus === "Refunded") {
    stage = "Settled";
  } else if (paidIn > 0 || statusSaysPaid) {
    stage = "To settle";
  }
  return { stage, paidIn, paidBack, kept: paidIn - paidBack };
}

/**
 * What's kept back from the damage deposit when this much of it is paid
 * back, as the tracking stores it ("350"). Empty when nothing is kept back,
 * or when the invoice has no damage deposit to compare with.
 */
export function damageKeptBack(deposit: number, paidBack: number): string {
  const keptBack = deposit - paidBack;
  return keptBack > 0 ? String(keptBack) : "";
}

/** "Payment received: R 2,000.00 on 12 Oct 2026 (EFT ref SMITH)." */
export function describePayment(
  payment: Pick<Payment, "kind" | "amount" | "paidOn" | "note">
): string {
  const on = payment.paidOn ? ` on ${shortDate(payment.paidOn)}` : "";
  const note = payment.note ? ` (${payment.note})` : "";
  return `${PAYMENT_KIND_LABELS[payment.kind]}: ${formatRand(payment.amount)}${on}${note}.`;
}

/** A new payment's cells, in the tab's column order */
export function paymentRow(
  columns: Record<PaymentColumn, number>,
  payment: Omit<Payment, "row" | "bookingKey"> & {
    /** The booking's timestamp as the sheet stores it */
    bookingKey: unknown;
    /** A Sheets date-and-time number */
    recordedAt: number;
  }
): unknown[] {
  const row: unknown[] = new Array(
    Math.max(...Object.values(columns)) + 1
  ).fill("");
  row[columns.id] = payment.id;
  row[columns.timestamp] = payment.bookingKey;
  row[columns.paidOn] = serialFromDate(payment.paidOn);
  row[columns.kind] = payment.kind;
  row[columns.amount] = payment.amount;
  row[columns.note] = payment.note;
  row[columns.recordedBy] = payment.recordedBy;
  row[columns.recordedAt] = payment.recordedAt;
  return row;
}
