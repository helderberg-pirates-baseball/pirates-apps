// An invoice as a PDF, made fresh from the "Invoices" tab each time.
// Add ?download to save it instead of opening it.
import type { APIRoute } from "astro";
import { loadBookingData } from "../../../../lib/data";
import { invoicePdf } from "../../../../lib/invoice-pdf";
import { invoiceFileName, invoiceSignature } from "../../../../lib/invoices";

export const GET: APIRoute = async ({ params, locals, url }) => {
  if (!locals.user.permissions.payments) {
    return new Response("You can't see invoices.", { status: 403 });
  }

  const data = await loadBookingData();
  const booking = data.bookings.find((b) => b.id === params.id);
  const invoice = data.invoices.invoices.find(
    (i) => i.bookingKey === booking?.timestampKey && i.number === params.number
  );
  if (!booking || !invoice) {
    return new Response("That invoice isn't there.", { status: 404 });
  }

  // Invoices saved before signatures are signed by whoever opens them
  const pdf = await invoicePdf(invoice, {
    signature: invoiceSignature(invoice, locals.user.name),
  });
  const fileName = invoiceFileName(invoice);
  const disposition = url.searchParams.has("download")
    ? "attachment"
    : "inline";
  // Older browsers read the plain name, newer ones the encoded one, which
  // keeps letters like ë
  const plainName = fileName.replace(/[^\x20-\x7e]/g, "_").replace(/"/g, "");
  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${disposition}; filename="${plainName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      // Invoices hold personal details: don't keep copies along the way
      "Cache-Control": "private, no-store",
    },
  });
};
