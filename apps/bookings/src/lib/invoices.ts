// Invoices, in the "Invoices" tab. The app owns the tab and adds a row per
// invoice.
//
// A booking has one current invoice. Editing a draft changes it in place.
// Editing one that has been sent replaces it: the old one is marked
// Replaced and the new one gets a new number, so a client never holds two
// different invoices with the same number.
import { timestampKey, type Booking } from "./bookings";
import { dateFromSerial, dayMonthYear, serialFromDate } from "./dates";

export const INVOICES_TAB = "Invoices";

export const INVOICE_STATUSES = ["Draft", "Sent", "Replaced"] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

// Prices in rand
export const RENTAL_PRICE = 3500;
export const DAMAGE_DEPOSIT = 500;
/** Members pay a flat rate, with no damage deposit */
export const MEMBER_RENTAL_PRICE = 1500;

export const DAMAGE_DEPOSIT_DESCRIPTION = "Damage Deposit (Refundable)";

export interface InvoiceLine {
  /** The rental and the damage deposit are always there; extra lines are added by hand */
  kind: "rental" | "deposit" | "extra";
  description: string;
  /** Rand */
  amount: number;
}

/** What someone fills in on the invoice form */
export interface InvoiceDetails {
  customer: string;
  address: string;
  /** The company's registration number, for companies */
  regNumber: string;
  phone: string;
  email: string;
  /** A deposit of R0 isn't a line: it's left off the invoice */
  lines: InvoiceLine[];
}

export interface Invoice extends InvoiceDetails {
  /** "INV-20261013-001" */
  number: string;
  /** The booking's timestamp */
  bookingKey: string;
  /** "2026-10-13" */
  issuedOn: string;
  status: InvoiceStatus;
  /** Its row in the tab (1 is the header row) */
  row: number;
}

export const INVOICE_COLUMNS = {
  number: "App_InvoiceNumber",
  timestamp: "App_Timestamp",
  issuedOn: "App_IssuedOn",
  status: "App_Status",
  customer: "App_Customer",
  address: "App_Address",
  regNumber: "App_RegNumber",
  phone: "App_Phone",
  email: "App_Email",
  // The lines as JSON, so any number of them fit in one cell
  lines: "App_Lines",
  // Only for reading in the sheet: the app adds up the lines itself
  total: "App_Total",
} as const;

export type InvoiceColumn = keyof typeof INVOICE_COLUMNS;

export interface InvoicesTab {
  columns: Record<InvoiceColumn, number>;
  invoices: Invoice[];
}

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function parseLines(json: string): InvoiceLine[] {
  try {
    const lines = JSON.parse(json);
    return Array.isArray(lines) ? lines : [];
  } catch {
    return [];
  }
}

function parseStatus(value: unknown): InvoiceStatus {
  const status = text(value);
  return (INVOICE_STATUSES as readonly string[]).includes(status)
    ? (status as InvoiceStatus)
    : "Draft";
}

/** Reads the "Invoices" tab's rows (header row first). Rows without a number are skipped. */
export function parseInvoicesTab(rows: unknown[][]): InvoicesTab {
  const [headerRow = [], ...dataRows] = rows;
  const headers = headerRow.map((header) => text(header).toLowerCase());

  const columns = {} as Record<InvoiceColumn, number>;
  for (const [column, header] of Object.entries(INVOICE_COLUMNS) as [
    InvoiceColumn,
    string,
  ][]) {
    columns[column] = headers.indexOf(header.toLowerCase());
    if (columns[column] === -1) {
      throw new Error(`The "${INVOICES_TAB}" tab has no "${header}" column`);
    }
  }

  const invoices: Invoice[] = [];
  dataRows.forEach((row, index) => {
    const number = text(row[columns.number]);
    if (!number) {
      return;
    }
    const issuedOn = row[columns.issuedOn];
    invoices.push({
      number,
      bookingKey: timestampKey(row[columns.timestamp]),
      issuedOn: typeof issuedOn === "number" ? dateFromSerial(issuedOn) : "",
      status: parseStatus(row[columns.status]),
      customer: text(row[columns.customer]),
      address: text(row[columns.address]),
      regNumber: text(row[columns.regNumber]),
      phone: text(row[columns.phone]),
      email: text(row[columns.email]),
      lines: parseLines(text(row[columns.lines])),
      row: index + 2,
    });
  });
  return { columns, invoices };
}

/** The booking's invoice that counts: the one that hasn't been replaced */
export function currentInvoice(
  invoices: Invoice[],
  bookingKey: string
): Invoice | undefined {
  return invoices.find(
    (invoice) =>
      invoice.bookingKey === bookingKey && invoice.status !== "Replaced"
  );
}

/** The booking's replaced invoices, newest first */
export function replacedInvoices(
  invoices: Invoice[],
  bookingKey: string
): Invoice[] {
  return invoices
    .filter(
      (invoice) =>
        invoice.bookingKey === bookingKey && invoice.status === "Replaced"
    )
    .reverse();
}

/**
 * "INV-20261013-003": the issue date, then a count that starts again at 001
 * each day, across every booking's invoices.
 *
 * Two people saving a new invoice in the same second could both get the same
 * number. With a handful of committee members that's unlikely enough to
 * accept rather than lock the sheet.
 */
export function nextInvoiceNumber(
  invoices: Invoice[],
  issuedOn: string
): string {
  const prefix = `INV-${issuedOn.replaceAll("-", "")}-`;
  const countsToday = invoices
    .filter((invoice) => invoice.number.startsWith(prefix))
    .map((invoice) => Number(invoice.number.slice(prefix.length)))
    .filter(Number.isFinite);
  const next = Math.max(0, ...countsToday) + 1;
  return `${prefix}${String(next).padStart(3, "0")}`;
}

/**
 * Typed-in numbers keep to the app's own format, "INV-20261013-001": a real
 * date as yyyyMMdd, then three digits. The date can be any day, past or
 * future.
 */
export function isValidInvoiceNumber(number: string): boolean {
  const match = /^INV-(\d{4})(\d{2})(\d{2})-\d{3}$/.exec(number);
  if (!match) {
    return false;
  }
  const [year, month, day] = match.slice(1).map(Number);
  // A date like 30 February rolls over into March, so it won't match
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/**
 * The number an invoice saves with. Left as `suggested`, the number the
 * form opened with, it's `unchanged`: a draft's own number, or whatever is
 * next in line for a new invoice. Anything else typed in is used as it is,
 * say to match an invoice already sent outside the app, as long as it isn't
 * one of `takenNumbers`.
 */
export function chooseInvoiceNumber(
  takenNumbers: string[],
  typed: string,
  suggested: string,
  unchanged: string
): { number: string } | { error: string } {
  const number = typed.trim();
  if (number === "" || number === suggested) {
    return { number: unchanged };
  }
  if (!isValidInvoiceNumber(number)) {
    return {
      error: `"${number}" isn't an invoice number like INV-20261013-001, with a real date in the middle.`,
    };
  }
  const isTaken = takenNumbers.some(
    (taken) => taken.toLowerCase() === number.toLowerCase()
  );
  if (isTaken) {
    return { error: `There's already an invoice ${number}.` };
  }
  return { number };
}

export function invoiceTotal(lines: InvoiceLine[]): number {
  return lines.reduce((total, line) => total + line.amount, 0);
}

export function depositAmount(lines: InvoiceLine[]): number {
  return invoiceTotal(lines.filter((line) => line.kind === "deposit"));
}

/** "R 3,500.00" */
export function formatRand(amount: number): string {
  return `R ${amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** "30 October 2026, 18:00 - 23:00", or as much of that as the booking has */
export function bookingWhen(booking: Booking): string {
  const time =
    booking.startTime && booking.endTime
      ? `${booking.startTime} - ${booking.endTime}`
      : booking.startTime
        ? `from ${booking.startTime}`
        : "";
  if (!booking.date) {
    return time;
  }
  return time
    ? `${dayMonthYear(booking.date)}, ${time}`
    : dayMonthYear(booking.date);
}

/** "Club House & Field Rental - 30 October 2026, 18:00 - 23:00" */
export function rentalDescription(booking: Booking): string {
  const when = bookingWhen(booking);
  return when
    ? `Club House & Field Rental - ${when}`
    : "Club House & Field Rental";
}

/**
 * What a new invoice starts with: the full price and the damage deposit.
 * The member rate is only applied once someone confirms they're a member.
 */
export function newInvoiceDetails(booking: Booking): InvoiceDetails {
  return {
    customer: booking.name,
    address: "",
    regNumber: "",
    phone: booking.phone,
    email: booking.email,
    lines: [
      {
        kind: "rental",
        description: rentalDescription(booking),
        amount: RENTAL_PRICE,
      },
      {
        kind: "deposit",
        description: DAMAGE_DEPOSIT_DESCRIPTION,
        amount: DAMAGE_DEPOSIT,
      },
    ],
  };
}

/**
 * An amount typed into the form: "3500", "3 500", "R3500" or "3500,50".
 * Blank is 0. Null if it isn't an amount.
 */
export function parseAmount(typed: string): number | null {
  const cleaned = typed.replace(/[R\s]/gi, "").replace(",", ".");
  if (cleaned === "") {
    return 0;
  }
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) {
    return null;
  }
  return Number(cleaned);
}

export interface InvoiceLinesForm {
  rentalDescription: string;
  rentalAmount: string;
  depositAmount: string;
  /** Extra lines, matched up by position */
  extraDescription: string[];
  extraAmount: string[];
}

/**
 * Everything on the invoice form, as text. It opens with a saved invoice or
 * a new one's details, or after a failed save with what was typed.
 */
export interface InvoiceFormValues extends InvoiceLinesForm {
  number: string;
  customer: string;
  address: string;
  regNumber: string;
  phone: string;
  email: string;
}

// Shown as plain numbers in the fields
function amountText(amount: number): string {
  return Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
}

/** The form's values for an invoice's details, with the full price when there's no rental line */
export function formValuesFor(
  details: InvoiceDetails,
  number: string
): InvoiceFormValues {
  const rental = details.lines.find((line) => line.kind === "rental");
  const extras = details.lines.filter((line) => line.kind === "extra");
  return {
    number,
    customer: details.customer,
    address: details.address,
    regNumber: details.regNumber,
    phone: details.phone,
    email: details.email,
    rentalDescription: rental?.description ?? "",
    rentalAmount: amountText(rental?.amount ?? RENTAL_PRICE),
    depositAmount: amountText(depositAmount(details.lines)),
    extraDescription: extras.map((line) => line.description),
    extraAmount: extras.map((line) => amountText(line.amount)),
  };
}

/** The form's values as they were sent */
export function formValuesFromSubmission(form: FormData): InvoiceFormValues {
  const field = (name: string) => String(form.get(name) ?? "");
  const all = (name: string) => form.getAll(name).map(String);
  return {
    number: field("number"),
    customer: field("customer"),
    address: field("address"),
    regNumber: field("regNumber"),
    phone: field("phone"),
    email: field("email"),
    rentalDescription: field("rentalDescription"),
    rentalAmount: field("rentalAmount"),
    depositAmount: field("depositAmount"),
    extraDescription: all("extraDescription"),
    extraAmount: all("extraAmount"),
  };
}

/** The invoice's lines from the form, or what's wrong with it */
export function linesFromForm(
  form: InvoiceLinesForm
): { lines: InvoiceLine[] } | { error: string } {
  const rentalDescription = form.rentalDescription.trim();
  const rentalAmount = parseAmount(form.rentalAmount);
  if (!rentalDescription) {
    return { error: "Describe the rental." };
  }
  if (rentalAmount === null) {
    return { error: `"${form.rentalAmount}" isn't an amount in rand.` };
  }
  const lines: InvoiceLine[] = [
    { kind: "rental", description: rentalDescription, amount: rentalAmount },
  ];

  const deposit = parseAmount(form.depositAmount);
  if (deposit === null) {
    return { error: `"${form.depositAmount}" isn't an amount in rand.` };
  }
  if (deposit > 0) {
    lines.push({
      kind: "deposit",
      description: DAMAGE_DEPOSIT_DESCRIPTION,
      amount: deposit,
    });
  }

  for (const [index, typed] of form.extraDescription.entries()) {
    const description = typed.trim();
    const typedAmount = form.extraAmount[index] ?? "";
    // The form always has a blank line to fill in
    if (!description && !typedAmount.trim()) {
      continue;
    }
    const amount = parseAmount(typedAmount);
    if (!description) {
      return { error: "Every extra line needs a description." };
    }
    if (amount === null) {
      return { error: `"${typedAmount}" isn't an amount in rand.` };
    }
    lines.push({ kind: "extra", description, amount });
  }
  return { lines };
}

/**
 * The damage deposit status to match the invoice: "Not required" when the
 * invoice has no deposit, and back to "Outstanding" if one is added again.
 * Once it's Paid or Refunded, the invoice doesn't change it.
 */
export function damageDepositStatusFor(
  lines: InvoiceLine[],
  current: string
): string {
  const hasDeposit = depositAmount(lines) > 0;
  if (!hasDeposit && current === "Outstanding") {
    return "Not required";
  }
  if (hasDeposit && current === "Not required") {
    return "Outstanding";
  }
  return current;
}

/** Sending an invoice moves the payment status on from None, never back from a payment */
export function paymentStatusWhenSent(current: string): string {
  return current === "None" ? "Invoice Sent" : current;
}

/**
 * The invoice's values by column, for writing to the sheet. The booking's
 * timestamp goes in as the sheet stores it, so it matches the other tabs.
 */
export function invoiceValues(
  invoice: Omit<Invoice, "row">,
  bookingTimestampCell: unknown
): Record<InvoiceColumn, unknown> {
  return {
    number: invoice.number,
    timestamp: bookingTimestampCell,
    issuedOn: serialFromDate(invoice.issuedOn),
    status: invoice.status,
    customer: invoice.customer,
    address: invoice.address,
    regNumber: invoice.regNumber,
    phone: invoice.phone,
    email: invoice.email,
    lines: JSON.stringify(invoice.lines),
    total: invoiceTotal(invoice.lines),
  };
}

/** A new row's cells, in the tab's column order */
export function invoiceRow(
  columns: Record<InvoiceColumn, number>,
  values: Record<InvoiceColumn, unknown>
): unknown[] {
  const row: unknown[] = new Array(
    Math.max(...Object.values(columns)) + 1
  ).fill("");
  for (const column of Object.keys(columns) as InvoiceColumn[]) {
    row[columns[column]] = values[column];
  }
  return row;
}

/** "INV-20261013-001 - John Doe.pdf", like the club's spreadsheet invoices */
export function invoiceFileName(invoice: Invoice): string {
  const customer = invoice.customer.replace(/[\\/:*?"<>|]/g, "").trim();
  return customer
    ? `${invoice.number} - ${customer}.pdf`
    : `${invoice.number}.pdf`;
}
