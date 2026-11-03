// Invoices for other club business, not for a booking: a sponsorship, a
// tournament fee, equipment sold, anything someone has to pay the club for.
//
// They live in the "Invoices" tab beside the bookings' invoices, with the
// booking's timestamp left empty. Sharing the tab means one run of numbers,
// so a club invoice and a booking invoice can never get the same number.
//
// Like a booking's invoice, a draft is changed in place, and changing one
// that has been sent replaces it with a new number.
import type { Email } from "./emails";
import {
  chooseInvoiceNumber,
  DEFAULT_SIGNER_TITLE,
  formatRand,
  invoiceTotal,
  nextInvoiceNumber,
  parseAmount,
  type Invoice,
  type InvoiceDetails,
  type InvoiceLine,
} from "./invoices";

/** The most lines one invoice can have, so it fits on one page */
export const MAX_CLUB_INVOICE_LINES = 12;

export function isClubInvoice(invoice: Invoice): boolean {
  return invoice.bookingKey === "";
}

/** Club invoices, newest first */
export function clubInvoices(invoices: Invoice[]): Invoice[] {
  return invoices.filter(isClubInvoice).reverse();
}

export function findClubInvoice(
  invoices: Invoice[],
  number: string
): Invoice | undefined {
  return invoices.find(
    (invoice) => isClubInvoice(invoice) && invoice.number === number
  );
}

/** Everything on the club invoice form, as text */
export interface ClubInvoiceFormValues {
  number: string;
  /** "2026-10-13" */
  issuedOn: string;
  customer: string;
  contactName: string;
  address: string;
  regNumber: string;
  vatNumber: string;
  phone: string;
  email: string;
  signerTitle: string;
  /** The lines, matched up by position */
  description: string[];
  amount: string[];
}

// Shown as plain numbers in the fields
function amountText(amount: number): string {
  return Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
}

/** The form's values for an invoice, or an empty form for a new one */
export function clubFormValuesFor(
  details: InvoiceDetails | undefined,
  number: string,
  issuedOn: string
): ClubInvoiceFormValues {
  return {
    number,
    issuedOn,
    customer: details?.customer ?? "",
    contactName: details?.contactName ?? "",
    address: details?.address ?? "",
    regNumber: details?.regNumber ?? "",
    vatNumber: details?.vatNumber ?? "",
    phone: details?.phone ?? "",
    email: details?.email ?? "",
    signerTitle: details?.signerTitle || DEFAULT_SIGNER_TITLE,
    description: details?.lines.map((line) => line.description) ?? [],
    amount: details?.lines.map((line) => amountText(line.amount)) ?? [],
  };
}

/** The form's values as they were sent */
export function clubFormValuesFromSubmission(
  form: FormData
): ClubInvoiceFormValues {
  const field = (name: string) => String(form.get(name) ?? "");
  const all = (name: string) => form.getAll(name).map(String);
  return {
    number: field("number"),
    issuedOn: field("issuedOn"),
    customer: field("customer"),
    contactName: field("contactName"),
    address: field("address"),
    regNumber: field("regNumber"),
    vatNumber: field("vatNumber"),
    phone: field("phone"),
    email: field("email"),
    signerTitle: field("signerTitle"),
    description: all("description"),
    amount: all("amount"),
  };
}

/** The invoice's lines from the form, or what's wrong with them */
export function clubLinesFromForm(
  descriptions: string[],
  amounts: string[]
): { lines: InvoiceLine[] } | { error: string } {
  const lines: InvoiceLine[] = [];
  for (const [index, typed] of descriptions.entries()) {
    const description = typed.trim();
    const typedAmount = amounts[index] ?? "";
    // The form always has a blank line to fill in
    if (!description && !typedAmount.trim()) {
      continue;
    }
    if (!description) {
      return { error: "Every line needs a description." };
    }
    const amount = parseAmount(typedAmount);
    if (amount === null) {
      return { error: `"${typedAmount}" isn't an amount in rand.` };
    }
    lines.push({ kind: "extra", description, amount });
  }
  if (lines.length === 0) {
    return { error: "Add at least one line to the invoice." };
  }
  if (lines.length > MAX_CLUB_INVOICE_LINES) {
    return {
      error: `An invoice can have up to ${MAX_CLUB_INVOICE_LINES} lines.`,
    };
  }
  return { lines };
}

/**
 * The number a club invoice saves with, or what's wrong with the one typed.
 * `editing` is the invoice being changed, if any: a draft keeps its number
 * unless another is typed, and anything else gets the next one in line.
 * Numbers typed by hand on bookings count as taken too.
 */
export function chooseClubInvoiceNumber(
  invoices: Invoice[],
  bookingInvoiceNumbers: string[],
  editing: Invoice | undefined,
  typed: string,
  suggested: string,
  today: string
): { number: string } | { error: string } {
  const isDraft = editing?.status === "Draft";
  const takenNumbers = [
    ...invoices
      .filter((invoice) => !(isDraft && invoice === editing))
      .map((invoice) => invoice.number),
    ...bookingInvoiceNumbers.filter(Boolean),
  ];
  return chooseInvoiceNumber(
    takenNumbers,
    typed,
    suggested,
    isDraft ? editing.number : nextInvoiceNumber(invoices, today)
  );
}

export const CLUB_INVOICE_SUBJECT = "Helderberg Pirates Baseball Club Invoice";

export function clubInvoiceEmail(invoice: Invoice): Email {
  return {
    to: invoice.email,
    subject: `${CLUB_INVOICE_SUBJECT} ${invoice.number}`,
    body: [
      "Good day,",
      "",
      `Please find attached invoice ${invoice.number} for ${formatRand(invoiceTotal(invoice.lines))}.`,
      "Feel free to reach out if you have any questions.",
      "",
      "Kind Regards",
    ].join("\n"),
  };
}
