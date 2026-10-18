// Everything that changes the spreadsheet. Each action checks the signed-in
// person's permissions on the server: hiding a button is a convenience, this
// is the check.
import {
  ActionError,
  defineAction,
  type ActionAPIContext,
} from "astro:actions";
import { z } from "astro/zod";
import { idNumberCell, RESPONSES_TAB } from "../lib/bookings";
import { loadBookingData, type BookingData } from "../lib/data";
import { sheetsNowInSouthAfrica, todayInSouthAfrica } from "../lib/dates";
import { DECLINE_REASONS } from "../lib/emails";
import {
  canChangeNote,
  HISTORY_TAB,
  historyRow,
  newEntryId,
  type HistoryEntry,
} from "../lib/history";
import {
  currentInvoice,
  damageDepositStatusFor,
  depositAmount,
  formatRand,
  invoiceRow,
  invoiceTotal,
  invoiceValues,
  INVOICES_TAB,
  linesFromForm,
  chooseInvoiceNumber,
  nextInvoiceNumber,
  parseAmount,
  paymentStatusWhenSent,
  type Invoice,
  type InvoiceColumn,
} from "../lib/invoices";
import {
  amountOverpaid,
  amountReceived,
  damageDepositAfterPayment,
  damageKeptBack,
  describePayment,
  PAYMENT_KINDS,
  paymentRow,
  PAYMENTS_TAB,
  paymentsFor,
  paymentStatusAfterPayment,
} from "../lib/payments";
import {
  appendRow,
  deleteRow,
  writeCells,
  type CellValue,
} from "../lib/sheets";
import {
  BOOKING_STATUSES,
  canDeleteIdNumber,
  changesToSave,
  DAMAGE_DEPOSIT_STATUSES,
  DEFAULT_TRACKING,
  describeChanges,
  editableFields,
  PAYMENT_STATUSES,
  TRACKING_TAB,
  type EditableField,
  type TrackedBooking,
  type Tracking,
  type TrackingColumn,
} from "../lib/tracking";
import type { SignedInUser } from "../lib/users";

function signedInUser(context: ActionAPIContext): SignedInUser {
  const { user } = context.locals;
  if (!user) {
    throw new ActionError({
      code: "UNAUTHORIZED",
      message: "Sign in again, then try again.",
    });
  }
  return user;
}

function findBooking(data: BookingData, bookingId: string): TrackedBooking {
  const booking = data.bookings.find((b) => b.id === bookingId);
  if (!booking) {
    throw new ActionError({
      code: "NOT_FOUND",
      message: "That booking isn't in the spreadsheet any more.",
    });
  }
  return booking;
}

function findNote(
  data: BookingData,
  noteId: string,
  user: SignedInUser
): HistoryEntry {
  const note = data.history.entries.find((entry) => entry.id === noteId);
  if (!note) {
    throw new ActionError({
      code: "NOT_FOUND",
      message: "That note isn't there any more.",
    });
  }
  if (!canChangeNote(note, user.email, sheetsNowInSouthAfrica())) {
    throw new ActionError({
      code: "FORBIDDEN",
      message:
        "You can only change your own notes, in the first 10 minutes after adding them.",
    });
  }
  return note;
}

// The booking's timestamp as the sheet stores it: a number, so it matches the
// copied Timestamp beside it
function timestampCell(booking: TrackedBooking): unknown {
  const asNumber = Number(booking.timestampKey);
  return Number.isNaN(asNumber) ? booking.timestampKey : asNumber;
}

/**
 * The booking's row in "Tracking Data". Throws when saving is paused because
 * the tab is out of line, so check this before writing anything else.
 */
function trackingRow(data: BookingData, booking: TrackedBooking): number {
  const { outOfLineRows, rowByTimestamp } = data.tracking;
  if (outOfLineRows.length > 0) {
    throw new ActionError({
      code: "CONFLICT",
      message: `"Tracking Data" no longer lines up with "Form responses 1" (row ${outOfLineRows.join(", ")}), so saving is paused. Ask an admin to fix the tab.`,
    });
  }
  const row = rowByTimestamp.get(booking.timestampKey);
  if (!row) {
    throw new ActionError({
      code: "CONFLICT",
      message: `This booking has no row in "Tracking Data". Check the tab's copy formula reaches it.`,
    });
  }
  return row;
}

/** Writes tracking values to the booking's row, with who saved them and when */
async function writeTracking(
  data: BookingData,
  booking: TrackedBooking,
  row: number,
  user: SignedInUser,
  values: Partial<Record<TrackingColumn, unknown>>
): Promise<void> {
  const { columns } = data.tracking;
  const cells: CellValue[] = [
    { row, column: columns.timestamp, value: timestampCell(booking) },
    ...(Object.keys(values) as TrackingColumn[]).map((column) => ({
      row,
      column: columns[column],
      value: values[column],
    })),
    { row, column: columns.updatedBy, value: user.email },
    { row, column: columns.updatedAt, value: sheetsNowInSouthAfrica() },
  ];
  await writeCells(TRACKING_TAB, cells);
}

/** Only the tracking values that differ from what's saved */
function trackingChanges(
  booking: TrackedBooking,
  wanted: Partial<Record<EditableField, string>>
): Partial<Record<EditableField, string>> {
  const changes: Partial<Record<EditableField, string>> = {};
  for (const field of Object.keys(wanted) as EditableField[]) {
    if (wanted[field] !== booking.tracking[field]) {
      changes[field] = wanted[field];
    }
  }
  return changes;
}

function requirePayments(user: SignedInUser): void {
  if (!user.permissions.payments) {
    throw new ActionError({
      code: "FORBIDDEN",
      message: "You can't work with invoices or payments.",
    });
  }
}

/** Writes a whole invoice over its row */
async function writeInvoice(
  data: BookingData,
  booking: TrackedBooking,
  invoice: Invoice
): Promise<void> {
  const { columns } = data.invoices;
  const values = invoiceValues(invoice, timestampCell(booking));
  await writeCells(
    INVOICES_TAB,
    (Object.keys(columns) as InvoiceColumn[]).map((column) => ({
      row: invoice.row,
      column: columns[column],
      value: values[column],
    }))
  );
}

async function addHistory(
  data: BookingData,
  booking: TrackedBooking,
  user: SignedInUser,
  type: "note" | "change",
  text: string
): Promise<void> {
  await appendRow(
    HISTORY_TAB,
    historyRow(data.history.columns, {
      id: newEntryId(),
      bookingKey: timestampCell(booking),
      at: sheetsNowInSouthAfrica(),
      by: user.email,
      type,
      text,
    })
  );
}

// The values the edit form showed, sent back as JSON
function parseShown(json: string): Tracking {
  try {
    return { ...DEFAULT_TRACKING, ...JSON.parse(json) };
  } catch {
    throw new ActionError({
      code: "BAD_REQUEST",
      message: "The form was out of date. Reload the page and try again.",
    });
  }
}

const NOTE_TEXT = z
  .string()
  .trim()
  .min(1, "Write something first.")
  .max(2000, "Keep notes under 2,000 characters.");

export const server = {
  /** Saves the edit form: only the fields this person may change, and only ones they changed */
  saveTracking: defineAction({
    accept: "form",
    input: z.object({
      bookingId: z.string(),
      // The values the form showed when it was opened, as JSON
      shown: z.string(),
      status: z.enum(BOOKING_STATUSES).optional(),
      paymentStatus: z.enum(PAYMENT_STATUSES).optional(),
      invoiceNumber: z.string().max(100).optional(),
      damageDeposit: z.enum(DAMAGE_DEPOSIT_STATUSES).optional(),
      damageKeptBack: z.string().max(100).optional(),
      damageNote: z.string().max(2000).optional(),
    }),
    handler: async (input, context) => {
      const user = signedInUser(context);
      if (editableFields(user.permissions).length === 0) {
        throw new ActionError({
          code: "FORBIDDEN",
          message: "You can't change bookings.",
        });
      }

      const data = await loadBookingData();
      const booking = findBooking(data, input.bookingId);
      const row = trackingRow(data, booking);

      const shown = parseShown(input.shown);
      const changes = changesToSave(shown, input, user.permissions);
      if (Object.keys(changes).length === 0) {
        return { changed: false };
      }

      await writeTracking(data, booking, row, user, changes);
      await addHistory(
        data,
        booking,
        user,
        "change",
        describeChanges(booking.tracking, changes)
      );
      return { changed: true };
    },
  }),

  addNote: defineAction({
    accept: "form",
    input: z.object({ bookingId: z.string(), text: NOTE_TEXT }),
    handler: async (input, context) => {
      const user = signedInUser(context);
      if (!user.permissions.notesAndStatus) {
        throw new ActionError({
          code: "FORBIDDEN",
          message: "You can't add notes.",
        });
      }
      const data = await loadBookingData();
      await addHistory(
        data,
        findBooking(data, input.bookingId),
        user,
        "note",
        input.text
      );
      return { added: true };
    },
  }),

  editNote: defineAction({
    accept: "form",
    input: z.object({ noteId: z.string(), text: NOTE_TEXT }),
    handler: async (input, context) => {
      const user = signedInUser(context);
      const data = await loadBookingData();
      const note = findNote(data, input.noteId, user);
      const { columns } = data.history;
      await writeCells(HISTORY_TAB, [
        { row: note.row, column: columns.text, value: input.text },
        {
          row: note.row,
          column: columns.editedAt,
          value: sheetsNowInSouthAfrica(),
        },
      ]);
      return { edited: true };
    },
  }),

  deleteNote: defineAction({
    accept: "form",
    input: z.object({ noteId: z.string() }),
    handler: async (input, context) => {
      const user = signedInUser(context);
      const data = await loadBookingData();
      const note = findNote(data, input.noteId, user);
      await deleteRow(HISTORY_TAB, note.row);
      return { deleted: true };
    },
  }),

  /** Clears the ID number in "Form responses 1", once the club no longer needs it */
  deleteIdNumber: defineAction({
    accept: "form",
    input: z.object({ bookingId: z.string() }),
    handler: async (input, context) => {
      const user = signedInUser(context);
      if (!user.permissions.editDetails) {
        throw new ActionError({
          code: "FORBIDDEN",
          message: "You can't delete ID numbers.",
        });
      }
      const data = await loadBookingData();
      const booking = findBooking(data, input.bookingId);
      if (!canDeleteIdNumber(booking, todayInSouthAfrica())) {
        throw new ActionError({
          code: "FORBIDDEN",
          message:
            "The ID number can be deleted once the function is over and the damage deposit is refunded or not required, or when the booking is cancelled.",
        });
      }
      const cell = idNumberCell(data.responseRows, booking.timestampKey);
      if (!cell) {
        throw new ActionError({
          code: "NOT_FOUND",
          message: "Couldn't find the ID number cell.",
        });
      }
      await writeCells(RESPONSES_TAB, [{ ...cell, value: "" }]);
      await addHistory(data, booking, user, "change", "ID number deleted.");
      return { deleted: true };
    },
  }),

  /**
   * Creates the booking's invoice, or saves changes to it. A draft is
   * changed in place. A sent invoice is replaced by a new one with a new
   * number, so the client never has two versions of one number.
   */
  saveInvoice: defineAction({
    accept: "form",
    input: z.object({
      bookingId: z.string(),
      // The invoice number the form was opened on, or empty for a new one
      shownNumber: z.string().optional(),
      // The invoice number as typed, and the one the form opened with
      number: z.string().max(40).optional(),
      suggestedNumber: z.string().optional(),
      customer: z
        .string()
        .trim()
        .min(1, "Fill in who the invoice is for.")
        .max(200),
      address: z.string().max(500).optional(),
      regNumber: z.string().max(100).optional(),
      phone: z.string().max(50).optional(),
      email: z.string().max(200).optional(),
      rentalDescription: z.string().max(300).optional(),
      rentalAmount: z.string().max(20).optional(),
      depositAmount: z.string().max(20).optional(),
      extraDescription: z.array(z.string().max(300)).max(12),
      extraAmount: z.array(z.string().max(20)).max(12),
    }),
    handler: async (input, context) => {
      const user = signedInUser(context);
      requirePayments(user);
      const data = await loadBookingData();
      const booking = findBooking(data, input.bookingId);
      const row = trackingRow(data, booking);

      const parsed = linesFromForm({
        rentalDescription: input.rentalDescription ?? "",
        rentalAmount: input.rentalAmount ?? "",
        depositAmount: input.depositAmount ?? "",
        extraDescription: input.extraDescription,
        extraAmount: input.extraAmount,
      });
      if ("error" in parsed) {
        throw new ActionError({ code: "BAD_REQUEST", message: parsed.error });
      }

      const all = data.invoices.invoices;
      const current = currentInvoice(all, booking.timestampKey);
      if ((current?.number ?? "") !== (input.shownNumber ?? "")) {
        throw new ActionError({
          code: "CONFLICT",
          message:
            "Someone else changed this invoice since you opened it. Reload the page and try again.",
        });
      }

      const details = {
        customer: input.customer,
        // Browsers send a text box's line breaks as \r\n; keep plain \n
        address: input.address?.replace(/\r\n?/g, "\n").trim() ?? "",
        regNumber: input.regNumber?.trim() ?? "",
        phone: input.phone?.trim() ?? "",
        email: input.email?.trim() ?? "",
        lines: parsed.lines,
      };
      const total = formatRand(invoiceTotal(parsed.lines));
      let historyText: string;

      const isDraft = current?.status === "Draft";
      // Numbers already used: every other invoice, and any typed in by hand
      // on another booking. This booking's own can be reused, to bring an
      // invoice sent outside the app into it.
      const takenNumbers = [
        ...all
          .filter((invoice) => !(isDraft && invoice === current))
          .map((invoice) => invoice.number),
        ...data.bookings
          .filter((other) => other.timestampKey !== booking.timestampKey)
          .map((other) => other.tracking.invoiceNumber)
          .filter(Boolean),
      ];
      const chosen = chooseInvoiceNumber(
        takenNumbers,
        input.number ?? "",
        input.suggestedNumber ?? "",
        isDraft ? current.number : nextInvoiceNumber(all, todayInSouthAfrica())
      );
      if ("error" in chosen) {
        throw new ActionError({ code: "BAD_REQUEST", message: chosen.error });
      }
      const number = chosen.number;

      if (isDraft) {
        await writeInvoice(data, booking, { ...current, ...details, number });
        historyText =
          number === current.number
            ? `Invoice ${number} changed (total ${total}).`
            : `Invoice ${current.number} changed to ${number} (total ${total}).`;
      } else {
        const values = invoiceValues(
          {
            ...details,
            number,
            bookingKey: booking.timestampKey,
            issuedOn: todayInSouthAfrica(),
            status: "Draft",
          },
          timestampCell(booking)
        );
        await appendRow(
          INVOICES_TAB,
          invoiceRow(data.invoices.columns, values)
        );
        if (current) {
          await writeCells(INVOICES_TAB, [
            {
              row: current.row,
              column: data.invoices.columns.status,
              value: "Replaced",
            },
          ]);
          historyText = `Invoice ${current.number} replaced by ${number} (total ${total}).`;
        } else {
          historyText = `Invoice ${number} created (total ${total}).`;
        }
      }

      const changes = trackingChanges(booking, {
        invoiceNumber: number,
        damageDeposit: damageDepositStatusFor(
          parsed.lines,
          booking.tracking.damageDeposit
        ),
      });
      if (Object.keys(changes).length > 0) {
        await writeTracking(data, booking, row, user, changes);
        historyText += ` ${describeChanges(booking.tracking, changes)}`;
      }
      await addHistory(data, booking, user, "change", historyText);
      return { number };
    },
  }),

  /** Marks the invoice as sent, once someone has emailed it to the client */
  markInvoiceSent: defineAction({
    accept: "form",
    input: z.object({ bookingId: z.string(), number: z.string() }),
    handler: async (input, context) => {
      const user = signedInUser(context);
      requirePayments(user);
      const data = await loadBookingData();
      const booking = findBooking(data, input.bookingId);
      const row = trackingRow(data, booking);
      const invoice = currentInvoice(
        data.invoices.invoices,
        booking.timestampKey
      );
      if (invoice?.number !== input.number) {
        throw new ActionError({
          code: "CONFLICT",
          message:
            "This invoice has been replaced since you opened it. Reload the page and try again.",
        });
      }
      if (invoice.status === "Sent") {
        return { changed: false };
      }

      await writeCells(INVOICES_TAB, [
        {
          row: invoice.row,
          column: data.invoices.columns.status,
          value: "Sent",
        },
      ]);
      let historyText = `Invoice ${invoice.number} sent.`;
      const changes = trackingChanges(booking, {
        invoiceNumber: invoice.number,
        paymentStatus: paymentStatusWhenSent(booking.tracking.paymentStatus),
      });
      if (Object.keys(changes).length > 0) {
        await writeTracking(data, booking, row, user, changes);
        historyText += ` ${describeChanges(booking.tracking, changes)}`;
      }
      await addHistory(data, booking, user, "change", historyText);
      return { changed: true };
    },
  }),

  /** A shortcut from New to Client Contacted, without opening the edit form */
  markClientContacted: defineAction({
    accept: "form",
    input: z.object({ bookingId: z.string() }),
    handler: async (input, context) => {
      const user = signedInUser(context);
      if (!user.permissions.notesAndStatus) {
        throw new ActionError({
          code: "FORBIDDEN",
          message: "You can't change a booking's status.",
        });
      }
      const data = await loadBookingData();
      const booking = findBooking(data, input.bookingId);
      // Someone may have changed the status since the page was loaded
      if (booking.tracking.status !== "New") {
        throw new ActionError({
          code: "CONFLICT",
          message: `The status is already ${booking.tracking.status}. Use Edit to change it.`,
        });
      }
      const row = trackingRow(data, booking);
      const changes = { status: "Client Contacted" };
      await writeTracking(data, booking, row, user, changes);
      await addHistory(
        data,
        booking,
        user,
        "change",
        describeChanges(booking.tracking, changes)
      );
      return { changed: true };
    },
  }),

  /** Declines a booking the club can't take, and saves why */
  declineBooking: defineAction({
    accept: "form",
    input: z.object({
      bookingId: z.string(),
      reason: z.enum(["booked", "match", "other"], {
        error: "Choose why the club can't take the booking.",
      }),
      otherReason: z.string().max(300).optional(),
    }),
    handler: async (input, context) => {
      const user = signedInUser(context);
      if (!user.permissions.notesAndStatus) {
        throw new ActionError({
          code: "FORBIDDEN",
          message: "You can't change a booking's status.",
        });
      }
      // The reason finishes the sentence "Unfortunately …", so drop a full stop
      const reason =
        input.reason === "other"
          ? (input.otherReason ?? "").trim().replace(/\.+$/, "")
          : DECLINE_REASONS[input.reason];
      if (!reason) {
        throw new ActionError({
          code: "BAD_REQUEST",
          message: "Write why the club can't take the booking.",
        });
      }

      const data = await loadBookingData();
      const booking = findBooking(data, input.bookingId);
      const row = trackingRow(data, booking);
      await writeTracking(data, booking, row, user, {
        status: "Declined",
        declineReason: reason,
      });
      const statusChange = describeChanges(booking.tracking, {
        status: "Declined",
      });
      await addHistory(
        data,
        booking,
        user,
        "change",
        `${statusChange} Reason: ${reason}.`
      );
      return { declined: true };
    },
  }),

  /**
   * Records money received from the client, or paid back. A payment moves
   * the payment status forward; paying back the damage deposit settles it;
   * paying back an overpayment changes no status; any other refund sets the
   * payment status to Refunded.
   */
  recordPayment: defineAction({
    accept: "form",
    input: z.object({
      bookingId: z.string(),
      kind: z.enum(PAYMENT_KINDS, {
        error: "Choose whether money came in or was paid back.",
      }),
      amount: z.string().max(20),
      paidOn: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "Fill in the date of the payment."),
      note: z.string().max(300).optional(),
      damageNote: z.string().max(2000).optional(),
    }),
    handler: async (input, context) => {
      const user = signedInUser(context);
      requirePayments(user);
      const amount = parseAmount(input.amount);
      // A cancelled booking can be settled with nothing paid back
      const allowsZero = input.kind === "Refund";
      if (amount === null || (amount === 0 && !allowsZero)) {
        throw new ActionError({
          code: "BAD_REQUEST",
          message: `"${input.amount}" isn't an amount in rand.`,
        });
      }

      const data = await loadBookingData();
      const booking = findBooking(data, input.bookingId);
      const row = trackingRow(data, booking);
      const invoice = currentInvoice(
        data.invoices.invoices,
        booking.timestampKey
      );
      const total = invoice ? invoiceTotal(invoice.lines) : 0;
      const deposit = invoice ? depositAmount(invoice.lines) : 0;
      const receivedBefore = amountReceived(
        paymentsFor(data.payments.payments, booking.timestampKey)
      );
      const overpaid = amountOverpaid(receivedBefore, total);
      if (input.kind === "Overpayment refund" && amount > overpaid) {
        throw new ActionError({
          code: "BAD_REQUEST",
          message:
            overpaid > 0
              ? `That's more than the ${formatRand(overpaid)} paid over the invoice.`
              : "Nothing has been paid over the invoice.",
        });
      }
      if (
        input.kind === "Damage deposit refund" &&
        deposit > 0 &&
        amount > deposit
      ) {
        throw new ActionError({
          code: "BAD_REQUEST",
          message: `That's more than the ${formatRand(deposit)} damage deposit on the invoice.`,
        });
      }

      const payment = {
        id: newEntryId(),
        paidOn: input.paidOn,
        kind: input.kind,
        amount,
        note: input.note?.trim() ?? "",
        recordedBy: user.email,
      };
      await appendRow(
        PAYMENTS_TAB,
        paymentRow(data.payments.columns, {
          ...payment,
          bookingKey: timestampCell(booking),
          recordedAt: sheetsNowInSouthAfrica(),
        })
      );

      let wanted: Partial<Record<EditableField, string>>;
      if (input.kind === "Payment") {
        const received = receivedBefore + amount;
        wanted = {
          paymentStatus: paymentStatusAfterPayment(
            booking.tracking.paymentStatus,
            received,
            total
          ),
          damageDeposit: damageDepositAfterPayment(
            booking.tracking.damageDeposit,
            received,
            total
          ),
        };
      } else if (input.kind === "Damage deposit refund") {
        wanted = {
          damageDeposit: "Refunded",
          damageKeptBack: damageKeptBack(deposit, amount),
        };
        const damageNote = input.damageNote?.trim();
        if (damageNote) {
          wanted.damageNote = damageNote;
        }
      } else if (input.kind === "Overpayment refund") {
        // The booking is still paid in full: nothing to change
        wanted = {};
      } else {
        wanted = { paymentStatus: "Refunded" };
      }

      let historyText = describePayment(payment);
      const changes = trackingChanges(booking, wanted);
      if (Object.keys(changes).length > 0) {
        await writeTracking(data, booking, row, user, changes);
        historyText += ` ${describeChanges(booking.tracking, changes)}`;
      }
      await addHistory(data, booking, user, "change", historyText);
      return { recorded: true };
    },
  }),

  /** Deletes a payment recorded by mistake. The tracking stays as it is. */
  deletePayment: defineAction({
    accept: "form",
    input: z.object({ bookingId: z.string(), paymentId: z.string() }),
    handler: async (input, context) => {
      const user = signedInUser(context);
      requirePayments(user);
      const data = await loadBookingData();
      const booking = findBooking(data, input.bookingId);
      const payment = data.payments.payments.find(
        (p) => p.id === input.paymentId && p.bookingKey === booking.timestampKey
      );
      if (!payment) {
        throw new ActionError({
          code: "NOT_FOUND",
          message: "That payment isn't there any more.",
        });
      }
      await deleteRow(PAYMENTS_TAB, payment.row);
      await addHistory(
        data,
        booking,
        user,
        "change",
        `Deleted: ${describePayment(payment)}`
      );
      return { deleted: true };
    },
  }),
};
