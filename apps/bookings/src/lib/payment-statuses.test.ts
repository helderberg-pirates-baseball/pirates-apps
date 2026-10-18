import { describe, expect, it } from "vitest";
import {
  damageDepositAfterPayment,
  paymentStatusAfterPayment,
  suggestedStatuses,
} from "./payment-statuses";

describe("paymentStatusAfterPayment", () => {
  it("is Deposit Paid from half the invoice, Full Payment Received from all of it", () => {
    expect(paymentStatusAfterPayment("Invoice Sent", 1999, 4000)).toBe(
      "Invoice Sent"
    );
    expect(paymentStatusAfterPayment("Invoice Sent", 2000, 4000)).toBe(
      "Deposit Paid"
    );
    expect(paymentStatusAfterPayment("Deposit Paid", 4000, 4000)).toBe(
      "Full Payment Received"
    );
    expect(paymentStatusAfterPayment("None", 4500, 4000)).toBe(
      "Full Payment Received"
    );
  });

  it("never moves back", () => {
    expect(paymentStatusAfterPayment("Full Payment Received", 100, 4000)).toBe(
      "Full Payment Received"
    );
  });

  it("leaves Refunded alone, and does nothing without an invoice", () => {
    expect(paymentStatusAfterPayment("Refunded", 4000, 4000)).toBe("Refunded");
    expect(paymentStatusAfterPayment("Invoice Sent", 2000, 0)).toBe(
      "Invoice Sent"
    );
  });
});

describe("damageDepositAfterPayment", () => {
  it("is Paid once the whole invoice is", () => {
    expect(damageDepositAfterPayment("Outstanding", 3999, 4000)).toBe(
      "Outstanding"
    );
    expect(damageDepositAfterPayment("Outstanding", 4000, 4000)).toBe("Paid");
  });

  it("leaves a settled or unneeded deposit alone", () => {
    expect(damageDepositAfterPayment("Not required", 1500, 1500)).toBe(
      "Not required"
    );
    expect(damageDepositAfterPayment("Refunded", 4000, 4000)).toBe("Refunded");
  });
});

describe("suggestedStatuses", () => {
  const sent = { paymentStatus: "Invoice Sent", damageDeposit: "Outstanding" };
  const paid = {
    paymentStatus: "Full Payment Received",
    damageDeposit: "Paid",
  };

  it("moves both forward with money in, counting what came in before", () => {
    expect(suggestedStatuses(sent, "Payment", 2000, 0, 4000)).toEqual({
      paymentStatus: "Deposit Paid",
      damageDeposit: "Outstanding",
    });
    expect(suggestedStatuses(sent, "Payment", 2000, 2000, 4000)).toEqual(paid);
  });

  it("makes the damage deposit Refunded when it's paid back", () => {
    expect(
      suggestedStatuses(paid, "Damage deposit refund", 500, 4000, 4000)
    ).toEqual({ ...paid, damageDeposit: "Refunded" });
  });

  it("makes the payment status Refunded when money is paid back", () => {
    expect(suggestedStatuses(sent, "Refund", 0, 2000, 4000)).toEqual({
      ...sent,
      paymentStatus: "Refunded",
    });
  });

  it("changes nothing when an overpayment is paid back", () => {
    expect(
      suggestedStatuses(paid, "Overpayment refund", 500, 4500, 4000)
    ).toEqual(paid);
  });
});
