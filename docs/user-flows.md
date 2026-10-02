# Core User Flows

Status: **Phase 1 draft — awaiting product-owner review.**
Related: [architecture.md](architecture.md) · [database.md](database.md)

Targets: a customer orders in **under 3 minutes**, a farmer publishes next week in **under 5 minutes** (spec §19).
Screens are described mobile-first. "→ DB" marks the authoritative server-side step.

---

## 1. Customer places a weekly order

**Entry:** the farmer shares `yourapp.com/f/ferma-kodra` (WhatsApp, Facebook, email signature).

1. **Farm page `/f/ferma-kodra`** (no login needed)
   - Header: farm name, short description, "Orders close Thursday 20:00", this week's message.
   - **"Produktet e freskëta të kësaj jave"**: a grid of product cards (one column on phones), each showing photo, name, `250 L / kg`, and a "Only 5 kg left" hint when stock is low.
   - Card controls: `[-] 2 kg [+]`. The first tap on **[Shto]** adds `quantity_step`, or `minimum_quantity` if larger. Max is capped at `maximum_quantity` and remaining stock.
   - A sticky bottom bar appears once the cart has items: `3 products · 1,350 L  [Vazhdo →]`.
2. **Cart drawer** (bottom sheet): lines with steppers and remove; subtotal; **[Vazhdo te porosia]**.
3. **Not logged in?** → `/register?farm=ferma-kodra&next=/f/ferma-kodra/checkout`. The page links to login for existing customers. The cart is kept in `localStorage` throughout.
   - Register form: first name, last name, phone, email, password, consent checkbox → "Check your email". The confirmation link (`/api/auth/confirm`) logs the user in and returns them to checkout with the cart intact.
4. **Checkout `/f/ferma-kodra/checkout`** (one screen)
   - Order summary (editable quantities).
   - **Pickup / Delivery** toggle, showing only the methods the farm has enabled. Delivery shows the fee and the farm's delivery information.
   - Delivery: pick a saved address or enter a new one (saved to the address book by default).
   - Phone (prefilled from profile), delivery notes, note to the farmer.
   - Totals: subtotal, delivery fee, **total**, "Payment in cash on delivery/pickup".
   - **[Dërgo porosinë]**. The button disables after the first tap, and an idempotency key generated when checkout opened protects against double submits.
5. → DB `place_order()` validates everything, reserves stock, snapshots prices, assigns order #1043, and queues emails.
6. **Confirmation `/account/orders/[id]?placed=1`**: "Thank you! Order #1043", item list, total, pickup/delivery details, and "Need a change? Call the farm: 06x xxx xxxx" (customers cannot edit orders, D-03). The cart is cleared.
7. Emails: customer gets an order summary; farmer gets "New order #1043 – Ana Hoxha – 1,550 L".

**Edge cases**

| Situation                                     | Behaviour                                                                                                     |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Stock ran out while the customer was deciding | `INSUFFICIENT_STOCK`: checkout highlights the line, "Only 2 kg left", and offers to adjust to 2 kg or remove. |
| Deadline passed during checkout               | `CYCLE_CLOSED`: "Orders for this week are closed. Next week's products will appear here soon."                |
| No published week                             | Farm page shows "Orders are closed right now" plus the farm info and the customer's last order (read-only).   |
| Farmer deactivated the customer               | `CUSTOMER_INACTIVE`: "Please contact the farm."                                                               |
| Cart from a previous week                     | Lines whose availability item is not in the current published week are dropped, with a small notice.          |

## 2. Farmer publishes weekly availability

**Entry:** `/farm` dashboard → **[Menaxho produktet e javës]** → `/farm/week`.

1. `/farm/week` opens the **next week that needs attention**: the current DRAFT if there is one, otherwise a prompt for next week.
   - No draft for next week → large card "Prepare week 12–18 October" with **[Kopjo javën e kaluar]** (primary) and "Start empty" (secondary).
2. **Copy last week** → DB `copy_cycle()`. A DRAFT is created with all of last week's active products, prices, quantities and the same deadline weekday and time.
3. **Edit table** (one row per product; on phones one compact card per product):
   ```text
   Domate         Sasia [100] kg   Çmimi [250] L/kg   ✓ Në shitje
   Kastravec      Sasia [ 50] kg   Çmimi [180] L/kg   ✓ Në shitje
   Sallatë        Sasia [ 80] copë Çmimi [100] L      ✓ Në shitje
   [+ Shto produkt nga katalogu]
   ```
   - Inputs save on blur (optimistic, with a small "Saved" tick), so there is no big form to lose.
   - Min/max per customer is under a collapsed "More options" per row (rarely used).
   - Deadline picker at the top (date + time, tenant timezone) and an optional message to customers.
4. **[Publiko javën]** → confirm dialog "Customers will be able to order until Thu 15 Oct, 20:00. The previous week will stop taking orders." → DB `publish_cycle()`.
5. The week shows **PUBLISHED** with a copyable farm link, "Share on WhatsApp", and "Close orders now" for an early close.
6. After publishing, prices and quantities can still be edited (e.g. add 20 kg more tomatoes). A price change applies only to new orders, since existing orders keep their snapshot.

**Validation:** at least one listed item, a future deadline, non-negative price, quantity ≥ already ordered (when inventory is enforced).

## 3. Farmer views aggregated orders

**Entry:** `/farm` → **[Shiko porositë]** → `/farm/orders` (the **Totals** tab is the default).

```text
JAVA 5–11 TETOR · 37 porosi · 146,500 L

Domate         43 kg     (18 porosi)
Kastravec      27 kg     (12 porosi)
Sallatë        31 copë   (15 porosi)
Mollë          18 kg     ( 9 porosi)
Djathë          9 kg     ( 7 porosi)

[Printo listën]
```

- Data comes from the view `farmer_cycle_product_totals`, excluding cancelled orders.
- A week selector defaults to the current week, with the previous weeks available.
- An optional status filter ("only CONFIRMED") answers "what do I still need to prepare?".
- The print stylesheet produces a clean A4 picking list. A per-customer packing list (one block per order) is printable from the Orders tab.

## 4. Farmer processes an order

**Entry:** `/farm/orders` → **Orders** tab (filters: status, pickup/delivery, search by name or number) → `/farm/orders/1042`.

```text
Porosia #1042                         E KONFIRMUAR
Sokol Kreshpa · 069 123 4567 [Telefono] [WhatsApp]
Dërgesë: Rr. Myslym Shyri 12, Tiranë — "Kati 3"

Domate         5 kg      1,250 L
Kastravec      2 kg        360 L
Sallatë        3 copë      300 L
Dërgesa                    200 L
Totali                   2,110 L

Shënim: "Pa qese plastike ju lutem"

[Shëno si "Në përgatitje"]           Anulo porosinë
```

1. One primary button always shows the **next** status (PLACED → "Confirm", CONFIRMED → "Preparing", PREPARING → "Ready", READY → "Delivered"). A small menu allows jumping steps.
2. Tap → DB `set_order_status()` → history row + customer email (for CONFIRMED, READY, DELIVERED, CANCELLED).
3. **Cancel** needs a confirmation and an optional reason. The stock goes back to the week.
4. **Bulk action** on the list: select several orders → "Mark as confirmed" or "Mark as delivered" (the end-of-delivery-round case).

## 5. Customer repeats a previous order

**Entry points:**

- the farm page (logged in): "Your last order" card at the top
- `/account/orders`: **[Përsërit]** on any order

```text
Porosia juaj e fundit (#1031, 28 shtator)

Domate       5 kg
Kastravec    2 kg
Sallatë      3 copë
Mollë        2 kg   — nuk ofrohet këtë javë

[Përsërit porosinë]
```

1. The server builds a **repeat proposal** with the pure function `buildRepeatCart(lastOrderItems, currentOffer)`. Each previous line is matched by `product_id` to a listed item of the current published week:
   - **available** → same quantity
   - **partially available** → quantity reduced to the remaining stock or `maximum_quantity` (rounded to the step), marked "only 3 kg available"
   - **unavailable** (not offered, unlisted, archived, or sold out) → shown greyed out with "no longer available"
   - **price changed** → the current price is shown (old price struck through), so nothing is surprising at checkout
2. **[Përsërit porosinë]** puts the available lines into the cart, replacing it after a confirmation if the cart wasn't empty, and opens the cart drawer. The customer adjusts and continues to checkout as in flow 1.
3. With no published week, the button is disabled: "Orders open when the farm publishes next week's products."

## 6. Supporting flows

| Flow                     | Summary                                                                                                                                                                                                         |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Login                    | `/login`: email + password → redirect to `next`, or by role: FARMER → `/farm`, PLATFORM_ADMIN → `/admin`, CUSTOMER → last farm visited or `/account/orders`.                                                    |
| Logout                   | Form POST server action → `supabase.auth.signOut()` → farm page or home.                                                                                                                                        |
| Password reset           | `/forgot-password` → email → `/api/auth/confirm?type=recovery` → `/reset-password`.                                                                                                                             |
| Admin onboards a farm    | `/admin/farms/new`: farm name, slug, contact, farmer's name and email → service role creates tenant + invites farmer → farmer sets password → `/farm/settings` checklist (logo, delivery info, first products). |
| Farmer manages products  | `/farm/products`: list with photo, unit and active toggle; add/edit form (name, category, unit, step, description, photo upload). Archiving hides the product from future weeks; past orders are unaffected.    |
| Farmer manages customers | `/farm/customers`: searchable list (name, phone, #orders, last order); detail shows contact, order history, private notes, deactivate.                                                                          |
| Customer manages account | `/account`: name, phone, language, address book; "Delete my account" sends a request to the platform admin (GDPR, D-23); order records are kept anonymised for the farm's bookkeeping.                          |
| Switch language          | Language switcher in header/footer → `sq` ↔ `en`, stored in a cookie and on `profiles.preferred_locale` (used for emails).                                                                                      |
