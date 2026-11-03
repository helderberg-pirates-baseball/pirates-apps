import { describe, expect, it } from "vitest";
import {
  chooseClubInvoiceNumber,
  clubFormValuesFor,
  clubFormValuesFromSubmission,
  clubInvoiceEmail,
  clubInvoices,
  clubLinesFromForm,
  findClubInvoice,
  MAX_CLUB_INVOICE_LINES,
} from "./club-invoices";
import { invoicePdf } from "./invoice-pdf";
import { invoiceValues, parseInvoicesTab, type Invoice } from "./invoices";

const HEADERS = [
  "App_InvoiceNumber",
  "App_Timestamp",
  "App_IssuedOn",
  "App_Status",
  "App_Customer",
  "App_Address",
  "App_RegNumber",
  "App_Phone",
  "App_Email",
  "App_Lines",
  "App_Total",
];

const SPONSOR_LINES = [
  { kind: "extra", description: "Shirt sponsorship 2027", amount: 5000 },
  { kind: "extra", description: "Banner", amount: 750.5 },
];

// prettier-ignore
const ROWS: unknown[][] = [
  ["INV-20261101-001", 46276.75166995371, 46327, "Sent", "John Doe", "", "", "", "", "[]", 0],
  ["INV-20261101-002", "", 46327, "Replaced", "Acme (Pty) Ltd", "1 Main Rd", "2020/123456/07", "", "pay@acme.co.za", JSON.stringify(SPONSOR_LINES), 5750.5],
  ["INV-20261102-001", "", 46328, "Draft", "Acme (Pty) Ltd", "1 Main Rd", "2020/123456/07", "", "pay@acme.co.za", JSON.stringify(SPONSOR_LINES), 5750.5],
];

const { invoices } = parseInvoicesTab([HEADERS, ...ROWS]);
const [bookingInvoice, , draft] = invoices;

describe("clubInvoices", () => {
  it("lists only invoices without a booking, newest first", () => {
    expect(clubInvoices(invoices).map((i) => i.number)).toEqual([
      "INV-20261102-001",
      "INV-20261101-002",
    ]);
  });

  it("finds a club invoice by number, but not a booking's", () => {
    expect(findClubInvoice(invoices, "INV-20261102-001")).toBe(draft);
    expect(findClubInvoice(invoices, bookingInvoice.number)).toBeUndefined();
  });

  it("saves with an empty booking timestamp", () => {
    expect(invoiceValues(draft, "").timestamp).toBe("");
  });
});

describe("clubLinesFromForm", () => {
  it("reads the lines, skipping empty ones", () => {
    expect(
      clubLinesFromForm(
        ["Tournament entry", "", " Umpire fee "],
        ["R1 200", "", "350,50"]
      )
    ).toEqual({
      lines: [
        { kind: "extra", description: "Tournament entry", amount: 1200 },
        { kind: "extra", description: "Umpire fee", amount: 350.5 },
      ],
    });
  });

  it("needs at least one line", () => {
    expect(clubLinesFromForm([""], [""])).toEqual({
      error: "Add at least one line to the invoice.",
    });
  });

  it("needs a description and a real amount", () => {
    expect(clubLinesFromForm([""], ["100"])).toEqual({
      error: "Every line needs a description.",
    });
    expect(clubLinesFromForm(["Fee"], ["lots"])).toEqual({
      error: '"lots" isn\'t an amount in rand.',
    });
  });

  it("keeps to one page's worth of lines", () => {
    const many = Array.from(
      { length: MAX_CLUB_INVOICE_LINES + 1 },
      (_, i) => `Line ${i}`
    );
    expect(
      clubLinesFromForm(
        many,
        many.map(() => "1")
      )
    ).toHaveProperty("error");
  });
});

describe("chooseClubInvoiceNumber", () => {
  const today = "2026-11-02";

  it("gives a new invoice the next number in line, shared with bookings", () => {
    expect(
      chooseClubInvoiceNumber(invoices, [], undefined, "", "", today)
    ).toEqual({ number: "INV-20261102-002" });
  });

  it("lets a draft keep its number", () => {
    expect(
      chooseClubInvoiceNumber(
        invoices,
        [],
        draft,
        draft.number,
        draft.number,
        today
      )
    ).toEqual({ number: draft.number });
  });

  it("gives a sent invoice a new number when it changes", () => {
    const sent: Invoice = { ...draft, status: "Sent" };
    expect(
      chooseClubInvoiceNumber(
        [...invoices.slice(0, 2), sent],
        [],
        sent,
        "INV-20261102-002",
        "INV-20261102-002",
        today
      )
    ).toEqual({ number: "INV-20261102-002" });
  });

  it("won't reuse a number from another invoice or a booking", () => {
    expect(
      chooseClubInvoiceNumber(
        invoices,
        [],
        undefined,
        bookingInvoice.number,
        "",
        today
      )
    ).toHaveProperty("error");
    expect(
      chooseClubInvoiceNumber(
        invoices,
        ["INV-20261020-001"],
        undefined,
        "INV-20261020-001",
        "",
        today
      )
    ).toHaveProperty("error");
  });
});

describe("the form values", () => {
  it("opens empty for a new invoice", () => {
    expect(
      clubFormValuesFor(undefined, "INV-20261102-002", "2026-11-02")
    ).toMatchObject({
      number: "INV-20261102-002",
      issuedOn: "2026-11-02",
      customer: "",
      contactName: "",
      description: [],
      amount: [],
    });
  });

  it("opens with a saved invoice's lines as plain numbers", () => {
    expect(
      clubFormValuesFor(
        { ...draft, contactName: "Jane Smith", validDays: 30 },
        draft.number,
        "2026-11-05"
      )
    ).toMatchObject({
      issuedOn: "2026-11-05",
      validDays: "30",
      customer: "Acme (Pty) Ltd",
      contactName: "Jane Smith",
      regNumber: "2020/123456/07",
      description: ["Shirt sponsorship 2027", "Banner"],
      amount: ["5000", "750.50"],
    });
  });

  it("reads back what was typed", () => {
    const form = new FormData();
    form.set("customer", "Acme");
    form.set("contactName", "Jane Smith");
    form.set("issuedOn", "2026-11-07");
    form.append("description", "Fee");
    form.append("description", "");
    form.append("amount", "10");
    form.append("amount", "");
    expect(clubFormValuesFromSubmission(form)).toMatchObject({
      customer: "Acme",
      contactName: "Jane Smith",
      issuedOn: "2026-11-07",
      description: ["Fee", ""],
      amount: ["10", ""],
    });
  });
});

describe("clubInvoiceEmail", () => {
  it("names the invoice and its total", () => {
    const email = clubInvoiceEmail(draft);
    expect(email.to).toBe("pay@acme.co.za");
    expect(email.subject).toContain(draft.number);
    expect(email.body).toContain("R 5,750.50");
  });
});

describe("invoicePdf for club invoices", () => {
  it("makes a PDF without the 50% deposit note", async () => {
    const signature = { name: "Lian Malan", title: "Treasurer" };
    const withDeposit = await invoicePdf(draft, { signature });
    const without = await invoicePdf(draft, { showDeposit: false, signature });
    expect(new TextDecoder().decode(without.slice(0, 5))).toBe("%PDF-");
    expect(without.length).toBeLessThan(withDeposit.length);
  });
});
