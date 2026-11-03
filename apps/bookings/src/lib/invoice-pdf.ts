// Draws an invoice as an A4 PDF, laid out like the club's spreadsheet invoice
import fontkit from "@pdf-lib/fontkit";
import {
  PDFDocument,
  rgb,
  StandardFonts,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";
import logoDataUrl from "../assets/invoice-logo.jpg?inline";
// Great Vibes, a handwriting font, for the signature (SIL Open Font License,
// in signature-font-LICENSE.txt beside it)
import signatureFontDataUrl from "../assets/signature-font.ttf?inline";
import { dayMonthYear } from "./dates";
import {
  formatRand,
  INVOICE_VALID_DAYS,
  invoiceTotal,
  invoiceValidUntil,
  type Invoice,
} from "./invoices";

const CLUB_NAME = "Helderberg Pirates Baseball Club";
const CLUB_ADDRESS = [
  "Lourensford Road",
  "Somerset West",
  "7130",
  "email: helderbergpirates@gmail.com",
];
const BANK_DETAILS = [
  CLUB_NAME,
  "Nedbank, Somerset West",
  "Branch Code: 106012",
  "Acc No: 1071 303 511",
];
const DEPOSIT_NOTE =
  "Please note that this booking will only be confirmed once we receive at least 50% of the total amount due:";

// A4, in points (1/72 inch)
const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const LEFT = 50;
const RIGHT = PAGE_WIDTH - 50;

// The table's columns: where descriptions start, and where amounts end
const DESCRIPTION_X = LEFT + 8;
const DESCRIPTION_WIDTH = 310;
const UNIT_PRICE_RIGHT = 450;
const TOTAL_RIGHT = RIGHT - 8;

const BLACK = rgb(0.1, 0.1, 0.1);
const GREY = rgb(0.4, 0.4, 0.4);
const LINE_GREY = rgb(0.8, 0.8, 0.8);
const HEADER_FILL = rgb(0.93, 0.93, 0.93);

interface Fonts {
  regular: PDFFont;
  bold: PDFFont;
  /** Handwriting, for the signature */
  script: PDFFont;
}

/** Who signs the invoice, at the bottom right */
export interface InvoiceSignature {
  /** "Lian Malan" */
  name: string;
  /** "Treasurer" */
  title: string;
}

// The signature's column on the right
const SIGNATURE_LEFT = 360;

// The page's margin, the same at the bottom as at the sides
const BOTTOM = PAGE_HEIGHT - 50;
// The signature sits in the bottom right corner: its line is this far up
// from the margin, with the printed name and title under it
const SIGNATURE_LINE_Y = BOTTOM - 30;
// The handwriting reaches about this far above the line
const SIGNATURE_TOP = SIGNATURE_LINE_Y - 40;

// The note on how long the invoice is valid, in the bottom left corner above
// "Thank you", as wide as the space left of the signature
const VALIDITY_SIZE = 9.5;
const VALIDITY_LINE_HEIGHT = 12;
const VALIDITY_WIDTH = SIGNATURE_LEFT - LEFT - 20;
// Where its last line ends, a gap above "Thank you"
const VALIDITY_BOTTOM = SIGNATURE_LINE_Y - 6;

// How far the bank details (left) and the 50% note (right) reach below the
// lines
const BANK_DETAILS_HEIGHT = 20 + 16 + BANK_DETAILS.length * 14;
const DEPOSIT_NOTE_HEIGHT = 85;

/**
 * The built-in PDF fonts only have Western European letters (é, ê and ë are
 * fine). Anything else, like an emoji in a name, becomes "?" instead of
 * failing the whole invoice. Line breaks are kept for wrap() to split on.
 */
function printable(font: PDFFont, text: string): string {
  const supported = new Set(font.getCharacterSet());
  return Array.from(text)
    .map((char) =>
      char === "\n" || supported.has(char.codePointAt(0)!) ? char : "?"
    )
    .join("");
}

/** Splits text into lines that fit the width. Line breaks in the text are kept. */
function wrap(
  text: string,
  font: PDFFont,
  size: number,
  width: number
): string[] {
  const lines: string[] = [];
  // Measuring a letter the font doesn't have fails, so replace those first
  for (const paragraph of printable(font, text).split("\n")) {
    let line = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word;
      if (line && font.widthOfTextAtSize(candidate, size) > width) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    lines.push(line);
  }
  return lines;
}

/** Writes text with its top at y (measured down from the top of the page) */
function write(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  font: PDFFont,
  size: number,
  color = BLACK
) {
  page.drawText(printable(font, text), {
    x,
    y: PAGE_HEIGHT - y - size,
    size,
    font,
    color,
  });
}

/** Writes text so it ends at x */
function writeRight(
  page: PDFPage,
  text: string,
  right: number,
  y: number,
  font: PDFFont,
  size: number,
  color = BLACK
) {
  const safe = printable(font, text);
  write(
    page,
    safe,
    right - font.widthOfTextAtSize(safe, size),
    y,
    font,
    size,
    color
  );
}

function horizontalLine(page: PDFPage, y: number, color = LINE_GREY) {
  page.drawLine({
    start: { x: LEFT, y: PAGE_HEIGHT - y },
    end: { x: RIGHT, y: PAGE_HEIGHT - y },
    thickness: 0.75,
    color,
  });
}

function drawHeader(
  page: PDFPage,
  fonts: Fonts,
  logo: Awaited<ReturnType<PDFDocument["embedJpg"]>>
) {
  page.drawImage(logo, {
    x: LEFT,
    y: PAGE_HEIGHT - 40 - 80,
    width: 80,
    height: 80,
  });

  writeRight(page, CLUB_NAME, RIGHT, 45, fonts.bold, 12);
  CLUB_ADDRESS.forEach((line, index) => {
    writeRight(page, line, RIGHT, 64 + index * 14, fonts.regular, 10, GREY);
  });

  write(page, "INVOICE", LEFT, 150, fonts.bold, 24);
  horizontalLine(page, 185, BLACK);
}

/** The customer on the left, the date and number on the right. Returns where it ends. */
function drawCustomer(page: PDFPage, fonts: Fonts, invoice: Invoice): number {
  const labelX = LEFT;
  const valueX = LEFT + 70;
  const valueWidth = 250;
  let y = 200;

  // Optional fields are left off when they're empty
  const rows: [string, string][] = [
    ["Customer", invoice.customer],
    // The person to address, when the customer is a business
    ["Attention", invoice.contactName ?? ""],
    ["Address", invoice.address],
    ["Reg No.", invoice.regNumber],
    ["VAT No.", invoice.vatNumber],
    ["Phone", invoice.phone],
    ["Email", invoice.email],
  ];
  for (const [label, value] of rows) {
    if (!value) continue;
    write(page, label, labelX, y, fonts.bold, 10, GREY);
    for (const line of wrap(value, fonts.regular, 10, valueWidth)) {
      write(page, line, valueX, y, fonts.regular, 10);
      y += 14;
    }
    y += 4;
  }

  const rightLabelX = 380;
  const rightValueX = 420;
  write(page, "Date:", rightLabelX, 200, fonts.bold, 10, GREY);
  write(
    page,
    dayMonthYear(invoice.issuedOn),
    rightValueX,
    200,
    fonts.regular,
    10
  );
  write(page, "Ref:", rightLabelX, 218, fonts.bold, 10, GREY);
  write(page, invoice.number, rightValueX, 218, fonts.regular, 10);

  return Math.max(y, 236);
}

/** The lines and the total. Returns where it ends. */
function drawLines(
  page: PDFPage,
  fonts: Fonts,
  invoice: Invoice,
  top: number
): number {
  let y = top;
  page.drawRectangle({
    x: LEFT,
    y: PAGE_HEIGHT - y - 22,
    width: RIGHT - LEFT,
    height: 22,
    color: HEADER_FILL,
  });
  write(page, "Description", DESCRIPTION_X, y + 6, fonts.bold, 10);
  writeRight(page, "Unit Price", UNIT_PRICE_RIGHT, y + 6, fonts.bold, 10);
  writeRight(page, "Total", TOTAL_RIGHT, y + 6, fonts.bold, 10);
  y += 22;

  for (const line of invoice.lines) {
    const descriptionLines = wrap(
      line.description,
      fonts.regular,
      10,
      DESCRIPTION_WIDTH
    );
    const rowTop = y + 7;
    descriptionLines.forEach((text, index) => {
      write(page, text, DESCRIPTION_X, rowTop + index * 13, fonts.regular, 10);
    });
    // There's no quantity, so the unit price and the total are the same
    writeRight(
      page,
      formatRand(line.amount),
      UNIT_PRICE_RIGHT,
      rowTop,
      fonts.regular,
      10
    );
    writeRight(
      page,
      formatRand(line.amount),
      TOTAL_RIGHT,
      rowTop,
      fonts.regular,
      10
    );
    y = rowTop + descriptionLines.length * 13 + 4;
    horizontalLine(page, y);
  }

  y += 8;
  writeRight(page, "TOTAL", UNIT_PRICE_RIGHT, y, fonts.bold, 11);
  writeRight(
    page,
    formatRand(invoiceTotal(invoice.lines)),
    TOTAL_RIGHT,
    y,
    fonts.bold,
    11
  );
  y += 20;
  horizontalLine(page, y, BLACK);
  return y;
}

/**
 * The bank details on the left, and the 50% to confirm a booking on the
 * right (bookings only)
 */
function drawFooter(
  page: PDFPage,
  fonts: Fonts,
  invoice: Invoice,
  top: number,
  showDeposit: boolean
) {
  const y = top + 20;
  write(page, "Bank Details:", LEFT, y, fonts.bold, 10);
  BANK_DETAILS.forEach((line, index) => {
    write(page, line, LEFT, y + 16 + index * 14, fonts.regular, 10);
  });

  if (showDeposit) {
    const noteX = 320;
    const noteLines = wrap(DEPOSIT_NOTE, fonts.regular, 9.5, RIGHT - noteX);
    noteLines.forEach((line, index) => {
      write(page, line, noteX, y + index * 13, fonts.regular, 9.5, GREY);
    });
    const halfY = y + noteLines.length * 13 + 8;
    write(page, "50% of Total", noteX, halfY, fonts.bold, 10);
    writeRight(
      page,
      formatRand(invoiceTotal(invoice.lines) / 2),
      TOTAL_RIGHT,
      halfY,
      fonts.bold,
      10
    );
  }
}

/**
 * The name in handwriting over a line, then the name and title printed
 * under it, like a signed paper invoice. Always in the bottom right corner.
 */
function drawSignature(
  page: PDFPage,
  fonts: Fonts,
  signature: InvoiceSignature
) {
  const name = signature.name.trim();
  const title = signature.title.trim();
  // Shrink a long name so it fits over the line
  const width = RIGHT - SIGNATURE_LEFT - 10;
  const handwriting = printable(fonts.script, name);
  let size = 28;
  while (
    size > 14 &&
    fonts.script.widthOfTextAtSize(handwriting, size) > width
  ) {
    size -= 1;
  }
  const lineY = SIGNATURE_LINE_Y;
  if (handwriting) {
    // Centred over the line, sitting just above it
    const x =
      SIGNATURE_LEFT +
      (RIGHT -
        SIGNATURE_LEFT -
        fonts.script.widthOfTextAtSize(handwriting, size)) /
        2;
    page.drawText(handwriting, {
      x,
      y: PAGE_HEIGHT - lineY + 6,
      size,
      font: fonts.script,
      color: rgb(0.05, 0.05, 0.15),
    });
  }
  page.drawLine({
    start: { x: SIGNATURE_LEFT, y: PAGE_HEIGHT - lineY },
    end: { x: RIGHT, y: PAGE_HEIGHT - lineY },
    thickness: 0.75,
    color: BLACK,
  });
  if (name) {
    writeRight(page, name, RIGHT, lineY + 6, fonts.regular, 10);
  }
  if (title) {
    writeRight(page, title, RIGHT, lineY + 20, fonts.regular, 10, GREY);
  }
}

/**
 * "This invoice is valid for 30 days from the invoice date." and, on its
 * own line, "Valid until: 3 December 2026."
 */
export function validityNote(issuedOn: string): string {
  return [
    `This invoice is valid for ${INVOICE_VALID_DAYS} days from the invoice date.`,
    `Valid until: ${dayMonthYear(invoiceValidUntil(issuedOn))}.`,
  ].join("\n");
}

/** The validity note's lines, or none when the invoice has no date */
function validityLines(fonts: Fonts, invoice: Invoice): string[] {
  return invoice.issuedOn
    ? wrap(
        validityNote(invoice.issuedOn),
        fonts.regular,
        VALIDITY_SIZE,
        VALIDITY_WIDTH
      )
    : [];
}

/** Where the validity note starts, so it ends just above "Thank you" */
function validityTop(lines: string[]): number {
  return VALIDITY_BOTTOM - lines.length * VALIDITY_LINE_HEIGHT;
}

/** How long the invoice is valid, just above "Thank you" */
function drawValidity(page: PDFPage, fonts: Fonts, lines: string[]) {
  const top = validityTop(lines);
  lines.forEach((line, index) => {
    write(
      page,
      line,
      LEFT,
      top + index * VALIDITY_LINE_HEIGHT,
      fonts.regular,
      VALIDITY_SIZE,
      GREY
    );
  });
}

/** Thanks in the bottom left corner, level with the name and title under the signature */
function drawThanks(page: PDFPage, fonts: Fonts) {
  write(page, "Thank you", LEFT, SIGNATURE_LINE_Y + 5, fonts.bold, 11);
  write(page, CLUB_NAME, LEFT, SIGNATURE_LINE_Y + 20, fonts.regular, 10, GREY);
}

function dataUrlBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  return Uint8Array.from(Buffer.from(base64, "base64"));
}

export interface InvoicePdfOptions {
  /**
   * The note that a booking is only confirmed once 50% is paid. Booking
   * invoices have it; invoices for other club business don't.
   */
  showDeposit?: boolean;
  /** Who signs it, at the bottom right */
  signature: InvoiceSignature;
}

export async function invoicePdf(
  invoice: Invoice,
  { showDeposit = true, signature }: InvoicePdfOptions
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Invoice ${invoice.number}`);
  pdf.setAuthor(CLUB_NAME);

  pdf.registerFontkit(fontkit);
  const fonts: Fonts = {
    regular: await pdf.embedFont(StandardFonts.Helvetica),
    bold: await pdf.embedFont(StandardFonts.HelveticaBold),
    // Only the letters used are kept, so the PDF stays small
    script: await pdf.embedFont(dataUrlBytes(signatureFontDataUrl), {
      subset: true,
    }),
  };
  const logo = await pdf.embedJpg(dataUrlBytes(logoDataUrl));

  const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  drawHeader(page, fonts, logo);
  const customerEnd = drawCustomer(page, fonts, invoice);
  const linesEnd = drawLines(page, fonts, invoice, customerEnd + 20);
  // A long invoice can leave too little room above the signature for the
  // bank details, so they go on a second page, which is then the one signed
  let lastPage = page;
  // The bank details must end above the validity note (which sits above
  // "Thank you"), and the 50% note above the signature
  const validity = validityLines(fonts, invoice);
  const fits =
    linesEnd + BANK_DETAILS_HEIGHT < validityTop(validity) - 10 &&
    (!showDeposit || linesEnd + DEPOSIT_NOTE_HEIGHT < SIGNATURE_TOP - 5);
  if (!fits) {
    lastPage = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    drawFooter(lastPage, fonts, invoice, 30, showDeposit);
  } else {
    drawFooter(page, fonts, invoice, linesEnd, showDeposit);
  }
  drawSignature(lastPage, fonts, signature);
  drawValidity(lastPage, fonts, validity);
  drawThanks(lastPage, fonts);

  return pdf.save();
}
