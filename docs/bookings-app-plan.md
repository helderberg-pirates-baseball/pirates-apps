# Bookings app plan

_Written 4 Oct 2026. A plan for `apps/bookings`: a private app where the committee manages clubhouse bookings that arrive through the club's Google Form._

**Status:** live at `bookings.helderbergpirates.co.za`, on Netlify, with every phase below done. The test copy of the spreadsheet stays for development.

## What it does

- Sign in with a Google account. Only people listed in the app get in.
- List the bookings from the form's response sheet, with a page per booking.
- Track each booking's status, payment status, invoice number and damage deposit, and add notes, all stored in the same spreadsheet.
- Make a booking's invoice as a PDF, and email it to the client from your own email app.
- Decline a booking the club can't take, and email the client why.
- Four permissions: view bookings, edit booking details, add notes and set status, and payments.
- Installs from the browser as an app on Android phones and iPhones, and is designed for phones first.

## How it works

```
Browser ──sign in──▶ Google ("who is this?")
   │
   ▼
Bookings app (on Netlify)
   ├── checks the user's permissions in the Users tab
   └── reads and writes the spreadsheet as a service account ──▶ Google Sheets
```

- People prove who they are with Google sign-in, which asks only for their name and email (`openid email profile`). Google doesn't review apps that ask only for these.
- The app reads and writes the sheet as a **service account**, not with each person's own Google access. The sheet is shared with the service account's email as Editor.
- **Why not use each person's own access to the sheet:** sharing is all or nothing (viewer, commenter or editor). Anyone given edit access so the app could write would also be able to open the sheet and change the payment status directly, and the app's permissions would mean nothing. Only the sheet's owners keep direct access.
- The server checks every change against the user's permissions. Hiding a button is a convenience, not the check.

## Stack

| Concern          | Choice                                                                                                                | Why                                                                                                                                                                                                            |
| ---------------- | --------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework        | Astro 7 with `output: 'server'`                                                                                       | Same as website-v2. A list, a detail page and forms suit server-rendered pages. Astro Actions handle form posts, with Zod validation.                                                                          |
| Hosting          | Netlify's free plan, with `@astrojs/netlify`                                                                          | The cPanel plan at Domains.co.za has no Node.js support. Netlify runs the server code, provides HTTPS and deploys from GitHub. The website, domain and email stay at Domains.co.za.                            |
| Sign-in          | Google sign-in through Google's own [`google-auth-library`](https://github.com/googleapis/google-auth-library-nodejs) | Google's official client, already used by the Sheets client, and it checks the ID token's signature. Auth.js is more than one provider needs. (Arctic, used at first, was retired by its author in July 2026.) |
| Sessions         | Astro sessions, stored in Netlify Blobs                                                                               | Built in, and the Netlify adapter sets up the storage. Session data stays on the server.                                                                                                                       |
| Sheets           | `@googleapis/sheets` with a service account key                                                                       | Google's official client, with types.                                                                                                                                                                          |
| Tests            | Vitest                                                                                                                | Tests the permission rules and the mapping from sheet rows to bookings without calling Google.                                                                                                                 |
| Cross-site posts | Astro's `security.checkOrigin` (on by default in server mode)                                                         | Rejects form posts sent from other sites.                                                                                                                                                                      |
| Phone app        | A PWA: web app manifest, icons and a hand-written service worker                                                      | Installs from the browser with no app store. About 40 lines of service worker, so no plugin is needed.                                                                                                         |
| Styling          | Plain CSS, mobile first: `src/styles/global.css` plus Astro's scoped styles, with light and dark themes               | A handful of screens doesn't need a CSS framework. Plain CSS is easy to follow. Colours are variables with a light and a dark set.                                                                             |

Each dependency is added in the phase that first uses it.

## Data in the spreadsheet

| Tab                | Written by                                                       | Contents                                                              |
| ------------------ | ---------------------------------------------------------------- | --------------------------------------------------------------------- |
| `Form responses 1` | Google Forms. The app only ever clears an ID number.             | One row per booking request, and nothing else                         |
| `Tracking Data`    | A formula copies the form tab; the app writes its `App_` columns | The form responses copied row by row, beside the app's `App_` columns |
| `History`          | The app                                                          | One row per note or saved change                                      |
| `Invoices`         | The app                                                          | One row per invoice                                                   |
| `Payments`         | The app                                                          | One row per payment received or paid back                             |
| `Users`            | The sheet's owners, by hand                                      | Email, plus one permission per column                                 |

- **`App_` columns belong to the app.** Every column the app reads or writes in `Tracking Data`, `History`, `Invoices` and `Payments` starts with `App_`. It ignores all other columns, except the copied Timestamp.
  - `Tracking Data`: `App_Timestamp`, `App_Status`, `App_PaymentStatus`, `App_InvoiceNumber`, `App_DamageDeposit`, `App_DamageKeptBack`, `App_DamageNote`, `App_DeclineReason`, `App_UpdatedBy`, `App_UpdatedAt`
  - `History`: `App_Id`, `App_Timestamp`, `App_At`, `App_By`, `App_Type` (`note` or `change`), `App_Text`, `App_EditedAt`
  - `Invoices`: `App_InvoiceNumber`, `App_Timestamp`, `App_IssuedOn` (format as **Date**), `App_Status` (`Draft`, `Sent` or `Replaced`), `App_Customer`, `App_Address`, `App_RegNumber`, `App_Phone`, `App_Email`, `App_Lines` (the invoice's lines as JSON), `App_Total` (only for reading in the sheet)
  - `Payments`: `App_Id`, `App_Timestamp`, `App_PaidOn` (format as **Date**), `App_Kind` (`Payment`, `Damage deposit refund`, `Refund` or `Overpayment refund`), `App_Amount` (always positive; the kind says which way the money went), `App_Note`, `App_RecordedBy`, `App_RecordedAt` (format as **Date time**)
- **`Tracking Data` copies the form tab row by row** with `=ARRAYFORMULA('Form responses 1'!A:Z)`, to the right of the `App_` columns. Row 5's `App_` values belong to the booking copied into row 5. The club chose this so the tab can be read on its own.
- **The safeguard.** The rows only stay lined up while nobody sorts or deletes rows in `Form responses 1`. So when the app saves a row, it also writes the booking's timestamp into `App_Timestamp`. If that stops matching the copied Timestamp beside it, every page shows a warning and the app won't save until the rows are lined up again. Bookings still show correctly, because the app matches values by `App_Timestamp`. Values typed by hand without an `App_Timestamp` belong to the booking in the same row.
- **A booking is identified by its submission timestamp.** The form doesn't allow response editing, so it never changes. Links use a short code made from the timestamp and email (`/bookings/3a3311903f33`), which doesn't reveal the email.
- **Values are written exactly as given** (the Sheets API's RAW mode), so an invoice number like 007 stays 007. Dates and times are written as numbers in South African time. Format those columns as **Date time** to read them in the sheet.
- **Only changed fields are saved.** The edit form sends back the values it showed, and a save writes only the fields that were changed. So two people editing different fields at the same time don't undo each other's work. If both change the same field, whoever saves last wins, because Sheets has no locking.
- **Columns in `Form responses 1` are found by header, not position.** The form's columns aren't in question order (End Time comes before Start Time), and some headers include the question's help text, so the app matches the start of each header.
- **Dates and times are read as the sheet's raw values**, not as text, so a date like 05/10 can't be misread as 10 May. "Today" is worked out in South African time, because Netlify's servers run on UTC.
- **Two versions of the form share the same columns.** Older rows put the date and start time together in "Date of Function", leave Start Time empty, and hold the number of hours in End Time. Newer rows put only the date in "Date of Function", and times of day in Start Time and End Time. The app tells them apart by whether Start Time is filled in. An end time before the start time means the function ends after midnight.
- **Numbers lose leading zeros.** ID numbers and phone numbers stored as numbers get their 0 back (13 digits for an ID, a 0 before 9-digit phone numbers).
- **The old hand-typed columns are gone.** State, Damage Deposit Paid/Refunded and Invoice Number were removed from `Form responses 1`, and tracking starts fresh in `Tracking Data`.
- **Development uses a copy.** Building and testing use a copy of the spreadsheet with made-up rows. The live sheet is only connected to the live app.
- **The sheet's ID is a setting, not code.** If the sheet is ever copied, for example when its owner changes, pointing the app at the copy is a settings change.

## Statuses

| Field          | Values                                                                                                                                                                                                                                                                    |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Booking status | **New** (the default: nobody has contacted the client yet), **Client Contacted**, **Cancelled** (the client called it off), **Declined** (the club can't take it, with the reason saved). There's no "Closed": the app knows a function is over once its date has passed. |
| Payment status | **None** (the default), **Invoice Sent**, **Deposit Paid** (usually 50% of the fee), **Full Payment Received**, **Refunded** (rare: money paid back after a cancellation)                                                                                                 |
| Damage deposit | **Outstanding** (the default), **Paid**, **Refunded** (records the amount kept back and what was damaged), **Not required** (set this when a booking doesn't need one)                                                                                                    |

- **A booking is confirmed**, and holds its date, once its payment status is Deposit Paid or Full Payment Received, unless it's Cancelled or Declined. Confirmed bookings get a green "Confirmed" badge, and a booking's page warns when another confirmed booking is on the same date.
- **Two kinds of deposit.** "Deposit Paid" is part of the hire fee. The damage deposit is always labelled "Damage deposit", so the two can't be confused.

## Invoices

- **Who:** people with the Payments permission. A booking's page has an Invoice panel with **Create invoice** or **Open invoice**.
- **Prices:** R3,500 plus a R500 damage deposit (refundable). The member rate is a flat R1,500 with no damage deposit: a tickbox fills in those amounts, and whoever makes the invoice checks the client really is a member first. Both amounts can be changed, and a damage deposit of 0 leaves it off the invoice. Extra lines can be added (up to 12).
- **Customer:** name, phone and email start from the booking. Address and company registration number are optional and only printed when filled in.
- **Numbers:** `INV-<date issued>-<count>`, like `INV-20261013-001`. The count starts at 001 each day and runs across all bookings. Two people saving a new invoice in the same second could get the same number; with a handful of users that's accepted rather than locking the sheet.
- **The PDF** follows the club's spreadsheet invoice: logo, club address, customer, date and reference, the lines, the total, bank details, and 50% of the total to confirm the booking. It's headed "INVOICE", not "TAX INVOICE": the club isn't VAT-registered, and a tax invoice would need the club's VAT number and a VAT amount. The app stores the invoice's details, not the PDF, and draws the PDF fresh each time it's opened.
- **Sending:** the app can't attach a file to an email link, so the invoice page offers **Share PDF** (phones: the share sheet attaches it to a new email), **Download PDF**, **Open in email app** (fills in the address, subject and message), and **Copy subject** / **Copy message**. Subject: "Pirates Club Rental".
- **Sent:** the app can't tell when an email goes, so **Mark as sent** is pressed by hand. It moves the payment status from None to Invoice Sent. It never moves it back from a payment.
- **Changing an invoice:** a draft changes in place. A sent invoice is replaced: it's marked Replaced, and the changes become a new invoice with a new number, so the client never has two versions of one number. Replaced invoices stay listed, with their PDFs.
- **The tracking follows the invoice:** saving one writes its number to the booking's invoice number, and sets the damage deposit to Not required when there isn't one (or back to Outstanding when one is added). A damage deposit that's Paid or Refunded is left alone. Every invoice change goes in the booking's history.

## Payments

- **Who:** people with the Payments permission. A booking's Invoice and payments panel lists what has come in and gone out, with **Record payment**.
- **Recording** (`/bookings/<code>/payment`): what happened (a payment received, the damage deposit paid back, money paid back after a cancellation, or an overpayment paid back; the last only shows when more than the invoice came in), the amount, the date (today by default) and an optional reference.
- **The tracking follows the payments**, never moving back:
  - A payment makes the payment status Deposit Paid once the payments add up to half the invoice, and Full Payment Received once they cover all of it. The damage deposit is paid with the invoice, so it becomes Paid then too. Without an invoice, nothing moves.
  - Paying back the damage deposit makes it Refunded. Anything less than the deposit on the invoice is saved as the amount kept back, with an optional note of what was damaged.
  - Paying back money after a cancellation makes the payment status Refunded.
  - Paying back an overpayment takes it off what was received and changes no status: the booking is still paid in full. It can't be more than was paid over the invoice.
- **Deleting a payment** is only for one recorded by mistake. The tracking stays as it is; Edit is there to fix it. Every payment, and every deletion, goes in the booking's history.
- **The treasurer's list** (`/payments`, linked in the top bar for people with Payments): what still needs doing, soonest function first, with each booking linking straight to the next step. Cancelled and declined bookings are left out. Payment details stay off the main list, so it stays uncluttered for everyone else.
  - **Needs an invoice:** today or later, no invoice, and not already paid in full or given an invoice number by hand. Past bookings are left out: they're from before the app made invoices.
  - **Invoice not sent:** the current invoice is a draft.
  - **Waiting for the deposit:** payment status Invoice Sent, with how much of the half is still due.
  - **Balance owing:** payment status Deposit Paid, with what's still to come.
  - **Damage deposit to pay back:** the function is over and the damage deposit is still Paid.
  - **Overpaid:** more than the invoice came in, with the difference still to pay back.
  - Functions within a week, or already past, are flagged in the first four. Money to pay back isn't flagged. The top of the page counts each section and adds up the money still to come.

## Add to calendar

- A calendar-plus button beside a booking's date, for anyone who can see bookings. It opens an `.ics` file, which the phone or computer adds to its default calendar app. iPhones and Macs open it in Calendar straight away; on Android it may download first, and needs a calendar app that opens `.ics` files.
- The event is titled **Booked Function (first name)**, at the club, from the start to the end time (the next day when it runs past midnight). A booking without a start time becomes a whole-day event.
- The event goes into someone's own calendar, which may sync anywhere, so it only holds the first name, the function type and a link back to the booking. No phone number or email.
- It doesn't update itself. If the booking's date or time changes, add it again: the event has a fixed ID, so most calendar apps replace the old one.

## Sharing a booking

- A **Share** button at the top of a booking's page, for anyone who can see bookings. It opens the phone's share sheet with the person's name and a link to the booking, to send to WhatsApp, email or any other app. Browsers without a share sheet (some desktops) copy the link instead.
- The link only works for people signed in with access, so sharing it doesn't show the booking to anyone else.

## Declining a booking

- **Who:** people with the Notes and status permission, from the **Decline** button on a booking's page.
- **Reasons:** another booking at that time, a match on that day, or something else (typed as the end of "Unfortunately …").
- Declining sets the status to Declined, saves the reason in `App_DeclineReason` and records it in the history. The booking's page then shows a **Let them know** panel with the email: open it in an email app, or copy the subject and message.

## Permissions

| Permission           | Allows                                                                                                                     |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| View bookings        | The list and detail pages                                                                                                  |
| Edit booking details | Changing the form's answers (date, times, contact details); deleting ID numbers                                            |
| Notes and status     | Adding notes, changing the booking status, and declining bookings                                                          |
| Payments             | Changing the payment status, the invoice number and the damage deposit; invoices; recording payments; the treasurer's list |

- **The `Users` tab** has a header row, then one row per person: `Email | VIEW_BOOKINGS | EDIT_BOOKING_DETAILS | NOTES_AND_STATUS | PAYMENTS`, with a ticked checkbox or "Yes" in each permission column the person has. Anything else, including "No" or a blank cell, means no. The permission headers are in capitals to show they're fixed names the app looks for, not labels to reword. The app needs those exact headers (upper or lower case), in any order. The app's pages show friendlier names, such as "View bookings".
- Every permission includes viewing.
- **Permissions are re-read every 5 minutes**, so changes in the `Users` tab take effect without signing out. People without access are re-checked on every visit, so they get in as soon as an admin adds them.
- **The app never shows ID numbers.** An SA ID number gives away a person's date of birth and gender, so it's the most sensitive field in the sheet under POPIA, and anyone who needs one can find it in the sheet. People who can edit booking details see whether one is on file, and can delete it once the club no longer needs it.
- After signing in, people who aren't in `Users`, or have no boxes ticked, see a page that tells them to ask an admin.
- **Checkboxes instead of roles:** with a handful of users, ticking boxes per person is easier to follow than a table of roles. If the list grows, roles can come later.
- The sheet's owners manage users in the sheet, not in the app.

## Google accounts

- **Users sign in with personal Gmail accounts**, so the OAuth consent screen is "External" and the `Users` tab decides what each person can do.
- **The consent screen stays in "Testing" for now**, because publishing it needs a privacy policy page. In Testing, only accounts listed under Google Auth Platform → Audience → Test users can sign in (up to 100), and anyone else sees "Access blocked". So each person has to be added in two places: the test users and the `Users` tab. The public privacy policy at `/privacy` lets the consent screen be published, after which only the `Users` tab matters. The app only asks for name and email, so publishing needs no Google review.
- **The Google Cloud project is owned by `helderbergpirates@gmail.com`, with `treasury@helderbergpirates.co.za` as a second owner.** Both have to be Google accounts. If `treasury@` is only a mailbox at Domains.co.za, create a Google account for that address first (no Gmail needed).
- **The sheet is owned by `lian.pirates@gmail.com` today and may move.** Transferring ownership between Gmail accounts keeps the sharing, so the app keeps working. If the sheet is copied instead, the app needs the copy's ID and the copy has to be shared with the service account.

## Phone app (PWA)

- **Installing:** on Android, Chrome offers "Install app", from its menu or a prompt. iPhones have no prompt: open the app in Safari and tap Share → Add to Home Screen.
- **What installing adds:** an icon on the home screen, and the app opens full screen without the browser's address bar.
- **No bookings offline, on purpose.** The service worker stores only a "You're offline" page. Bookings hold personal details and change often. Storing them on phones would mean out-of-date statuses, and personal data left on lost or shared phones. Every page comes from the server.
- **Signing in on iPhone:** an installed iPhone app keeps its cookies separate from Safari, so people sign in once more inside the app. Sessions last 30 days, and the session cookie has the same lifetime, so closing the app doesn't sign people out.
- **Push notifications** (e.g. "new booking request") are possible later. iPhones support them only in installed apps (iOS 16.4 and later). Not planned yet.
- **Files:** `public/manifest.webmanifest`, `public/icons/`, `public/sw.js` and `src/pages/offline.astro`. The icons are generated from `apps/website/img/Logo.png`.

## Styling: mobile first

- The base styles are for phones. Wider screens add to them with `min-width` media queries, never the other way round.
- Buttons and fields are at least 48px tall (`--tap-size`). Form fields use 16px text, because iOS zooms in on anything smaller.
- On phones, the booking list is a list of cards rather than a table. Wide screens can use a table if it helps.
- Native controls: `<select>` for statuses, and `<input type="date">` for dates, so phones show their own pickers.
- Colours come from the club website: orange `#c9491a`, dark `#222429` and light `#f4f5f8`.
- **Loading:** the sheet can take a few seconds to read, so after a tap the page shows a progress bar under the top bar, dims and stops responding, and the tapped card or button shows a spinner. A form can't be sent twice. This matters most in the installed app, which has no browser loading indicator.

## Phases

Each phase is one or more pull requests.

### 0. Scaffold (done)

- `apps/bookings` with Astro in server mode, the Netlify adapter and a placeholder page. `netlify.toml` holds the build settings.
- `pnpm dev:bookings` (port 4322, so it can run next to website-v2) and `pnpm build:bookings` at the root.
- The manifest, icons, service worker and offline page, and the base mobile-first styles.

### 1. Prove the hosting (done)

- A Netlify account under `helderbergpirates@gmail.com`, deploying this repo with the package directory `apps/bookings`.
- `bookings.helderbergpirates.co.za` points at Netlify with a CNAME record in the **Domains.co.za client area's DNS settings**. That's the domain's live DNS. cPanel's Zone Editor only holds an unused copy with the email record, so records added there do nothing.

Netlify deploys `main` to the live site and builds a preview for each pull request. Previews can't sign in, because Google only accepts sign-in from listed addresses, but they're fine for checking pages.

### 2. Google setup and sign-in (done)

- Set up: a Google Cloud project owned by `helderbergpirates@gmail.com` with `treasury@helderbergpirates.co.za` as a second owner, an "External" consent screen in Testing with test users, an OAuth web client returning to `/auth/callback` on localhost and the live subdomain, and a service account shared as Editor on the test copy of the spreadsheet.
- Built: sign-in with `google-auth-library` (`/auth/google`, `/auth/callback`), 30-day sessions, sign-out as a form post (`/logout`), middleware that sends signed-out visitors to `/login` and remembers where they were going, the `Users` lookup, and a "No access yet" page.
- The five settings are declared in Astro's `astro:env` schema and listed in `apps/bookings/.env.example`. Locally they go in `apps/bookings/.env`, which git ignores. On Netlify they go in the project's environment variables. They're never committed or pasted into chat.
- `pnpm test:bookings` covers reading the `Users` tab and the sign-in redirects. `pnpm check:bookings` type-checks the TypeScript. (`astro check` is broken with this setup's dependencies and is being deprecated, so the check runs `tsc` directly.)
- **Done when** sign-in works inside the installed app on an Android phone, not just in a browser.

### 3. Read bookings (done)

- **The list** (`/`): a search box, Upcoming / Past / All tabs with counts, and cards grouped under month headings. Upcoming is the default and includes today; past and all are newest first. Search matches every word against the name, email, phone (with or without spaces), function, special considerations, status, invoice number and date ("october", "saturday"). Search and tab are in the address (`/?when=past&q=birthday`), so they work without JavaScript and can be shared. Cancelled and declined bookings are hidden, and left out of the counts, until **Show cancelled or declined** adds `cancelled=show` to the address.
- **A booking** (`/bookings/<code>`): the date and time with how long it runs, contact details with copy buttons (and one to copy them all), tap-to-call and tap-to-email links, the form's answers, and the hand-typed tracking columns, read-only. The app doesn't show ID numbers.
- **Themes:** System, Light or Dark, chosen in the account menu and saved on the device. A script in `<head>` applies it before the page is drawn, so it never flashes the wrong theme.
- The responses tab is called `Form responses 1` (lowercase r), in both the real sheet and the test copy.
- `src/lib/bookings.fixtures.ts` holds made-up rows in the API's raw format, covering both form versions. The tests read them.

### 4. Tracking and notes (done)

- **Editing:** an **Edit** button on a booking's page (only for people who can change something) opens `/bookings/<code>/edit`. It shows only the fields that person may change: the status needs "Notes and status", and payments, the invoice number and the damage deposit need "Payments". **Save** writes only the fields that changed, and **Cancel** goes back. "Amount kept back" and "What was damaged" appear once the damage deposit is set to Refunded.
- **Notes:** an "Add note" box on the booking's page, for people with "Notes and status". Authors can edit or delete their own note for 10 minutes after adding it.
- **History:** every save also adds a line to the booking's history ("Payment status: None → Deposit Paid."). The booking's page shows notes and changes together, newest first.
- **Taken dates:** a "Confirmed" badge on cards and booking pages, and a warning on a booking's page when another confirmed booking is on the same date.
- **Deleting ID numbers:** "Delete ID number", behind a confirmation step, for people who can edit booking details. It's offered once the function is over and the damage deposit is Refunded or Not required, or when the booking is Cancelled. It clears the cell in `Form responses 1` and records the deletion in the history. Google Forms keeps its own copy of the response.
- Every change goes through an Astro Action that checks the permission on the server. Hiding a button is only a convenience.

### 5. Editing booking details (done)

- Changing the form's answers from the app, for people with the "Edit booking details" permission.

### 6. Invoices and declining (done)

See [Invoices](#invoices) and [Declining a booking](#declining-a-booking). A new booking's Contact panel also has **Mark as client contacted**, for people with Notes and status: a shortcut from New to Client Contacted without opening Edit. The sheet needs, **before this is deployed** (the app stops loading without them):

1. In `Tracking Data`, an `App_DeclineReason` column among the `App_` columns.
2. A new `Invoices` tab with the headers in row 1: `App_InvoiceNumber`, `App_Timestamp`, `App_IssuedOn`, `App_Status`, `App_Customer`, `App_Address`, `App_RegNumber`, `App_Phone`, `App_Email`, `App_Lines`, `App_Total`. Format `App_IssuedOn` as Date and `App_Total` as currency.

### 7. Payments and the treasurer's list (done)

See [Payments](#payments). The main list also hides cancelled and declined bookings until asked for. The sheet needs, **before this is deployed** (the app stops loading without it):

1. A new `Payments` tab with the headers in row 1: `App_Id`, `App_Timestamp`, `App_PaidOn`, `App_Kind`, `App_Amount`, `App_Note`, `App_RecordedBy`, `App_RecordedAt`. Format `App_PaidOn` as Date, `App_Amount` as currency and `App_RecordedAt` as Date time.

### 8. Go live (done)

On the real spreadsheet:

1. Remove the three hand-typed columns (State, Damage Deposit Paid/Refunded, Invoice Number) from `Form responses 1`. Then send one test response through the form and check it lands in the right columns.
2. Add the `Tracking Data`, `History`, `Invoices` and `Payments` tabs exactly as in the test copy: the `App_` headers, the copy formula, the Date time formats and the dropdowns.
3. Share the spreadsheet with the service account as Editor.
4. Fill in the `Users` tab.
5. Change `SPREADSHEET_ID` in Netlify to the real sheet.

## Decided

| Decision                          | Answer                                                                                                                                                                                                            |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hosting                           | Netlify. The cPanel plan has no Node.js support.                                                                                                                                                                  |
| Who can sign in                   | Personal Gmail accounts that are test users in Google Cloud and listed in `Users` ("External" consent screen, in Testing)                                                                                         |
| Google Cloud project owner        | `helderbergpirates@gmail.com`, with `treasury@helderbergpirates.co.za` as second owner                                                                                                                            |
| Booking key                       | The submission timestamp                                                                                                                                                                                          |
| "Allow response editing"          | Off                                                                                                                                                                                                               |
| Statuses                          | See [Statuses](#statuses)                                                                                                                                                                                         |
| When a booking holds its date     | Deposit Paid or Full Payment Received, unless Cancelled                                                                                                                                                           |
| ID numbers                        | The form keeps asking, to identify who's legally responsible for the hire. The app never shows them: they're in the sheet if needed.                                                                              |
| Invoice number and damage deposit | Part of the payments permission                                                                                                                                                                                   |
| Refunds after a cancellation      | Usually not, but the payment status has a Refunded option for when it happens                                                                                                                                     |
| App name and colour on phones     | "Bookings" under the icon, and the website's orange in Android's title bar                                                                                                                                        |
| How long records are kept         | Bookings and payments: 5 years, the usual period for financial records. ID numbers: deleted once the damage deposit is settled.                                                                                   |
| Privacy policy                    | A public page at `/privacy`, covering committee members who sign in, not the booking form. Requests go to info@helderbergpirates.co.za, and the Information Officer is the Chairperson.                           |
| Editing                           | An Edit button opens an edit page with Save and Cancel. Notes are added straight on the booking's page.                                                                                                           |
| Tracking Data layout              | The form responses copied row by row, beside `App_` columns, with the `App_Timestamp` safeguard                                                                                                                   |
| Old hand-typed columns            | Dropped. Tracking starts fresh.                                                                                                                                                                                   |
| Notes                             | Authors can edit or delete their own note for 10 minutes                                                                                                                                                          |
| Change history                    | Every save is recorded in the booking's history                                                                                                                                                                   |
| Taken dates                       | A Confirmed badge, plus a warning on clashing dates                                                                                                                                                               |
| Invoices                          | Payments permission. R3,500 + R500 damage deposit, or R1,500 and no deposit for members (confirmed by hand). Headed "INVOICE" (the club isn't VAT-registered). Details stored in `Invoices`, PDF drawn on demand. |
| Sending invoices                  | From the person's own email app: Share PDF on phones, Download PDF, an email link, and copy buttons. Marked as sent by hand.                                                                                      |
| Changing a sent invoice           | Replaces it with a new number; the old one is marked Replaced                                                                                                                                                     |
| Declining bookings                | A Declined status with a saved reason (another booking, a match, or typed), and an email to send. Notes and status permission.                                                                                    |
| Deleting ID numbers               | A button for people who can edit booking details, once the function is over and the damage deposit is settled (or the booking is cancelled). It clears the sheet only; Google Forms keeps its copy.               |

## Still open

Nothing at the moment.

## Risks

- **A leaked key gives full edit access to the sheet.** Keep it only in Netlify's environment variables and a local `.env`, never in the repo. Replace it when someone with access to it leaves the committee.
- **Personal information.** Bookings hold names, phone numbers, email addresses and ID numbers, which South Africa's privacy law (POPIA) protects. Only listed users can see bookings, the app never shows ID numbers, development uses made-up data, and the app doesn't log booking contents.
- **The sheet changes owner by copying.** The copy has a new ID and isn't shared with the service account. Update the app's setting and share the copy.
- **Rows in `Form responses 1` are sorted or deleted.** `Tracking Data`'s copy shifts while the `App_` values stay put. The safeguard spots it, warns on every page and pauses saving. Someone then has to line the rows up again by hand.
- **Netlify's free plan has a monthly usage allowance.** If the app used it all, Netlify would pause the site until the next month. A committee app should use a small fraction of it; check the usage after the first month.
- **Sheets API quotas.** Every request comes from the one service account, which gets 60 reads a minute. A page needs one or two reads (one `batchGet` covers several tabs), so this only matters with many users at once. Cache reads for a short time if it ever does.
- **The logo is small.** The only logo in the repo is 364×364 pixels, so the 512px icons are slightly soft. A larger or vector version of the logo would fix this.
