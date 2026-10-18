import { describe, expect, it } from "vitest";
import { parseBookings, type Booking } from "./bookings";
import { RESPONSE_HEADERS, RESPONSE_ROWS } from "./bookings.fixtures";
import { invoicePdf } from "./invoice-pdf";
import {
  bookingWhen,
  currentInvoice,
  damageDepositStatusFor,
  formatRand,
  invoiceFileName,
  invoiceRow,
  invoiceTotal,
  invoiceValues,
  linesFromForm,
  newInvoiceDetails,
  chooseInvoiceNumber,
  formValuesFor,
  formValuesFromSubmission,
  isValidInvoiceNumber,
  nextInvoiceNumber,
  parseAmount,
  parseInvoicesTab,
  paymentStatusWhenSent,
  replacedInvoices,
  type Invoice,
  type InvoiceLine,
} from "./invoices";

const bookings = parseBookings([RESPONSE_HEADERS, ...RESPONSE_ROWS]);

function byName(name: string): Booking {
  const booking = bookings.find((b) => b.name === name);
  if (!booking) throw new Error(`No booking for ${name}`);
  return booking;
}

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

const LINES: InvoiceLine[] = [
  { kind: "rental", description: "Club House & Field Rental", amount: 3500 },
  { kind: "deposit", description: "Damage Deposit (Refundable)", amount: 500 },
];

// prettier-ignore
const ROWS: unknown[][] = [
  ["INV-20261012-001", 46276.75166995371, 46307, "Replaced", "John Doe", "", "", "0711111111", "example@mail.co.za", JSON.stringify(LINES), 4000],
  ["INV-20261013-001", 46276.75166995371, 46308, "Sent", "John Doe", "", "", "0711111111", "example@mail.co.za", JSON.stringify(LINES), 4000],
  ["", "", "", "", "", "", "", "", "", "", ""],
  ["INV-20261013-002", 46227.39008162037, 46308, "Draft", "Jane Someone", "", "", "", "", "not json", ""],
];

const tab = parseInvoicesTab([HEADERS, ...ROWS]);

describe("parseInvoicesTab", () => {
  it("reads each invoice and where it is", () => {
    expect(tab.invoices).toHaveLength(3);
    expect(tab.invoices[1]).toMatchObject({
      number: "INV-20261013-001",
      bookingKey: "46276.75166995371",
      issuedOn: "2026-10-13",
      status: "Sent",
      lines: LINES,
      row: 3,
    });
  });

  it("treats unreadable lines as none, rather than failing the page", () => {
    expect(tab.invoices[2].lines).toEqual([]);
  });

  it("names a missing column", () => {
    expect(() =>
      parseInvoicesTab([HEADERS.filter((h) => h !== "App_Lines")])
    ).toThrow('The "Invoices" tab has no "App_Lines" column');
  });
});

describe("current and replaced invoices", () => {
  it("finds the invoice that hasn't been replaced", () => {
    expect(currentInvoice(tab.invoices, "46276.75166995371")?.number).toBe(
      "INV-20261013-001"
    );
    expect(currentInvoice(tab.invoices, "46279.352024618056")).toBeUndefined();
    expect(
      replacedInvoices(tab.invoices, "46276.75166995371").map((i) => i.number)
    ).toEqual(["INV-20261012-001"]);
  });
});

describe("nextInvoiceNumber", () => {
  it("counts up from the day's last number, across all bookings", () => {
    expect(nextInvoiceNumber(tab.invoices, "2026-10-13")).toBe(
      "INV-20261013-003"
    );
  });

  it("starts at 001 on a new day", () => {
    expect(nextInvoiceNumber(tab.invoices, "2026-10-14")).toBe(
      "INV-20261014-001"
    );
  });
});

describe("chooseInvoiceNumber", () => {
  const SUGGESTED = "INV-20261013-003";
  // The invoices' numbers, and one typed in by hand on another booking
  const TAKEN = [
    ...tab.invoices.map((invoice) => invoice.number),
    "INV-20250301-001",
  ];

  it("uses the unchanged number when the suggestion is left as it is", () => {
    // Someone else may have taken the suggestion since the form opened
    expect(
      chooseInvoiceNumber(TAKEN, SUGGESTED, SUGGESTED, "INV-20261013-004")
    ).toEqual({ number: "INV-20261013-004" });
    expect(
      chooseInvoiceNumber(TAKEN, " ", SUGGESTED, "INV-20261013-004")
    ).toEqual({ number: "INV-20261013-004" });
  });

  it("uses a number typed in, such as one sent outside the app", () => {
    expect(
      chooseInvoiceNumber(TAKEN, " INV-20240115-007 ", SUGGESTED, SUGGESTED)
    ).toEqual({ number: "INV-20240115-007" });
  });

  it("won't reuse another invoice's number, even a replaced one", () => {
    expect(
      chooseInvoiceNumber(TAKEN, "INV-20261012-001", SUGGESTED, SUGGESTED)
    ).toEqual({ error: "There's already an invoice INV-20261012-001." });
  });

  it("won't reuse a number typed in by hand on another booking", () => {
    expect(
      chooseInvoiceNumber(TAKEN, "INV-20250301-001", SUGGESTED, SUGGESTED)
    ).toEqual({ error: "There's already an invoice INV-20250301-001." });
  });

  it("only takes numbers like INV-20261013-001, with a real date", () => {
    const errors = [
      "2024/15",
      "INV-2026101-001",
      "INV-20261013-01",
      "inv-20261013-004",
      "INV-20261332-001",
      "INV-20260230-001",
    ].map((typed) => chooseInvoiceNumber(TAKEN, typed, SUGGESTED, SUGGESTED));
    for (const result of errors) {
      expect(result).toHaveProperty("error");
    }
  });

  it("takes a date in the past or the future", () => {
    expect(isValidInvoiceNumber("INV-20200229-001")).toBe(true);
    expect(isValidInvoiceNumber("INV-20991231-999")).toBe(true);
  });
});

describe("invoice form values", () => {
  it("show a saved invoice's amounts as plain numbers", () => {
    const values = formValuesFor(
      {
        customer: "John Doe",
        address: "",
        regNumber: "",
        phone: "",
        email: "",
        lines: [...LINES, { kind: "extra", description: "Bar", amount: 250.5 }],
      },
      "INV-20261013-001"
    );
    expect(values).toMatchObject({
      number: "INV-20261013-001",
      rentalAmount: "3500",
      depositAmount: "500",
      extraDescription: ["Bar"],
      extraAmount: ["250.50"],
    });
  });

  it("keep what was typed, mistakes and all", () => {
    const form = new FormData();
    form.set("number", "INV-20250301-001");
    form.set("customer", "John Doe");
    form.set("rentalAmount", "35OO");
    form.append("extraDescription", "Bar");
    form.append("extraAmount", "250");
    form.append("extraDescription", "");
    form.append("extraAmount", "");
    expect(formValuesFromSubmission(form)).toMatchObject({
      number: "INV-20250301-001",
      customer: "John Doe",
      address: "",
      rentalAmount: "35OO",
      extraDescription: ["Bar", ""],
      extraAmount: ["250", ""],
    });
  });
});

describe("new invoices", () => {
  it("start at the full price with the damage deposit", () => {
    const details = newInvoiceDetails(byName("Person Sur"));
    expect(details.customer).toBe("Person Sur");
    expect(details.lines).toEqual([
      {
        kind: "rental",
        description:
          "Club House & Field Rental - 30 October 2026, 20:00 - 23:00",
        amount: 3500,
      },
      {
        kind: "deposit",
        description: "Damage Deposit (Refundable)",
        amount: 500,
      },
    ]);
  });

  it("work out the end time of older bookings from the hours booked", () => {
    expect(bookingWhen(byName("John Doe"))).toBe(
      "16 October 2026, 18:00 - 01:00"
    );
  });
});

describe("parseAmount", () => {
  it("reads amounts typed in different ways", () => {
    expect(parseAmount("3500")).toBe(3500);
    expect(parseAmount("R 3 500")).toBe(3500);
    expect(parseAmount("3500,50")).toBe(3500.5);
    expect(parseAmount("")).toBe(0);
  });

  it("rejects anything that isn't an amount", () => {
    expect(parseAmount("abc")).toBeNull();
    expect(parseAmount("-50")).toBeNull();
    expect(parseAmount("1.234")).toBeNull();
  });
});

describe("linesFromForm", () => {
  const form = {
    rentalDescription: "Club House & Field Rental",
    rentalAmount: "3500",
    depositAmount: "500",
    extraDescription: ["Extra cleaning", ""],
    extraAmount: ["250", ""],
  };

  it("makes the lines, skipping the empty extra line", () => {
    expect(linesFromForm(form)).toEqual({
      lines: [
        {
          kind: "rental",
          description: "Club House & Field Rental",
          amount: 3500,
        },
        {
          kind: "deposit",
          description: "Damage Deposit (Refundable)",
          amount: 500,
        },
        { kind: "extra", description: "Extra cleaning", amount: 250 },
      ],
    });
  });

  it("leaves a deposit of 0 off the invoice", () => {
    const result = linesFromForm({ ...form, depositAmount: "0" });
    expect("lines" in result && result.lines.map((l) => l.kind)).toEqual([
      "rental",
      "extra",
    ]);
  });

  it("says what's wrong", () => {
    expect(linesFromForm({ ...form, rentalAmount: "lots" })).toEqual({
      error: '"lots" isn\'t an amount in rand.',
    });
    expect(
      linesFromForm({ ...form, extraDescription: [""], extraAmount: ["100"] })
    ).toEqual({ error: "Every extra line needs a description." });
  });
});

describe("tracking that follows the invoice", () => {
  it("marks the damage deposit not required when there isn't one", () => {
    const noDeposit = LINES.filter((l) => l.kind !== "deposit");
    expect(damageDepositStatusFor(noDeposit, "Outstanding")).toBe(
      "Not required"
    );
    expect(damageDepositStatusFor(LINES, "Not required")).toBe("Outstanding");
    // A deposit that's already paid or refunded is left alone
    expect(damageDepositStatusFor(noDeposit, "Paid")).toBe("Paid");
    expect(damageDepositStatusFor(LINES, "Refunded")).toBe("Refunded");
  });

  it("moves the payment status to Invoice Sent, never back from a payment", () => {
    expect(paymentStatusWhenSent("None")).toBe("Invoice Sent");
    expect(paymentStatusWhenSent("Deposit Paid")).toBe("Deposit Paid");
  });
});

describe("writing an invoice", () => {
  it("puts each value in its column, with the date as a Sheets day number", () => {
    const invoice = tab.invoices[1];
    const row = invoiceRow(
      tab.columns,
      invoiceValues(invoice, 46276.75166995371)
    );
    expect(row).toEqual(ROWS[1]);
  });
});

describe("formatting", () => {
  it("writes rand with cents", () => {
    expect(formatRand(3500)).toBe("R 3,500.00");
    expect(formatRand(invoiceTotal(LINES) / 2)).toBe("R 2,000.00");
  });

  it("names the file like the club's spreadsheet invoices", () => {
    const invoice = { ...tab.invoices[1], customer: "John/Doe" } as Invoice;
    expect(invoiceFileName(invoice)).toBe("INV-20261013-001 - JohnDoe.pdf");
  });
});

describe("invoicePdf", () => {
  it("makes a PDF, even with letters the PDF fonts don't have", async () => {
    const invoice: Invoice = {
      ...tab.invoices[1],
      customer: "Zoë Ndlovu 🎉",
      address: "12 Main Road\nSomerset West",
    };
    const pdf = await invoicePdf(invoice);
    expect(new TextDecoder().decode(pdf.slice(0, 5))).toBe("%PDF-");
  });
});
