# Build a Multi-Tenant Farm-to-Consumer Weekly Ordering Platform

> **Product specification.** Decisions in [decisions.md](decisions.md) clarify and override this document where they differ.

## 1. Product Vision

Build a modern web application that helps small/local farmers manage weekly orders from their customers.

The initial real-world use case is a farmer who currently receives customer orders through email. Customers send messy/free-form emails describing what they want, which makes it difficult for the farmer to organize, aggregate, and fulfill orders.

The application should replace this process with a simple, mobile-first ordering experience.

The core workflow is:

**Farmer publishes weekly availability → Customers place orders → Farmer sees aggregated orders → Farmer prepares orders → Orders are fulfilled**

The first deployment will be used by **one farmer**, but the architecture MUST be multi-tenant from the beginning so that additional farmers can be onboarded later without changing the fundamental architecture.

Do NOT build a marketplace initially.

Build a **multi-tenant SaaS platform that initially serves one farmer**.

---

# 2. Technology Stack

Use the following technologies unless there is a strong technical reason to change something:

### Frontend

* Next.js
* React
* TypeScript
* App Router
* Tailwind CSS
* shadcn/ui
* Responsive/mobile-first design

### Backend

Use Next.js as the initial backend.

Use:

* Server Actions where appropriate
* Route Handlers for APIs/webhooks
* Server Components where appropriate

DO NOT create a separate Spring Boot/backend service at this stage.

### Database / Backend Services

Use:

* Supabase
* PostgreSQL
* Supabase Auth
* Supabase Storage if image storage is required

Use PostgreSQL relational modeling properly.

### Deployment

* Vercel
* GitHub-based deployment

The application should be easy to deploy to Vercel.

### Validation

* Zod

### Forms

* React Hook Form where useful

### Testing

* Vitest for unit tests
* Playwright for important end-to-end flows

---

# 3. Architectural Principles

Follow these principles:

1. Multi-tenant from day one.
2. Keep the architecture simple.
3. Start as a modular monolith.
4. Do not introduce microservices.
5. Keep business logic separate from UI components.
6. Use PostgreSQL relational modeling rather than storing business data as JSON unnecessarily.
7. Every tenant-specific entity must be associated with a farmer/tenant.
8. Enforce tenant isolation at the database level using Supabase Row Level Security (RLS).
9. Never rely only on frontend checks for authorization.
10. Design the system so additional farmers can be added without architectural changes.
11. Do not prematurely implement marketplace functionality.
12. Build the smallest useful MVP first.
13. The farmer experience must be extremely simple.
14. The customer experience must be mobile-first.

---

# 4. Core User Types

The application should initially have three roles:

### CUSTOMER

A person who buys products from a farmer.

Capabilities:

* Register/login
* Browse the farmer's weekly products
* Add products to cart
* Place weekly order
* View current and previous orders
* Repeat a previous order
* Manage profile
* Manage delivery/contact information

### FARMER

The farmer who manages one tenant.

Capabilities:

* Login
* Manage profile/farm information
* Manage products
* Create weekly availability
* Set prices
* Set available quantities
* Publish/unpublish weekly availability
* View customer orders
* View aggregated quantities
* View individual customer orders
* Change order status
* Manage customers

### PLATFORM_ADMIN

System administrator.

Capabilities:

* View farmers
* Create/deactivate farmers
* View platform-level information
* Manage tenants
* Basic support functionality

Do not build a complicated admin system initially.

---

# 5. Multi-Tenant Model

Use the concept of a tenant/farmer.

Recommended core model:

```text
tenants
farmers
users
products
weekly_availability
orders
order_items
customers
addresses
```

A farmer/tenant owns their products, availability, customers and orders.

Conceptually:

```text
Tenant/Farmer
    |
    +-- Products
    |
    +-- Weekly Availability
    |
    +-- Customers
    |
    +-- Orders
          |
          +-- Order Items
```

All tenant-specific database records must contain the appropriate tenant/farmer reference.

Design this so that:

```text
Farmer A
    customers
    products
    orders

Farmer B
    customers
    products
    orders
```

remain completely isolated.

Use Supabase RLS to enforce this isolation.

---

# 6. Database Design

Design the database carefully before implementing the UI.

At minimum consider the following entities.

## tenants

Fields:

* id
* name
* slug
* description
* logo_url
* phone
* email
* address
* delivery_information
* active
* created_at
* updated_at

The `slug` should be unique.

Example:

```text
farm-a
farm-b
```

---

## users

Use Supabase Auth for authentication.

Create a profile/user table if needed.

Fields:

* id
* auth_user_id
* role
* tenant_id
* first_name
* last_name
* phone
* created_at
* updated_at

Roles:

```text
CUSTOMER
FARMER
PLATFORM_ADMIN
```

Think carefully about whether customers should be associated with one tenant or multiple tenants.

For the MVP, it is acceptable for a customer to belong to a tenant, but design the model so this can evolve later into a customer ordering from multiple farmers.

---

# 7. Products

Products belong to a farmer/tenant.

Example:

```text
Tomatoes
Cucumbers
Apples
Lettuce
Fresh eggs
Cheese
```

Fields:

* id
* tenant_id
* name
* description
* category
* unit
* image_url
* active
* created_at
* updated_at

Units should support:

```text
kg
gram
piece
liter
box
dozen
```

Do not hard-code units throughout the frontend.

---

# 8. Weekly Availability

This is one of the most important concepts in the application.

Unlike a supermarket, a farmer does not necessarily have the same inventory every week.

Create a weekly availability model.

Example:

```text
Week: October 5–11

Tomatoes
Available: 100 kg
Price: 250 ALL/kg

Cucumbers
Available: 50 kg
Price: 180 ALL/kg

Lettuce
Available: 80 pieces
Price: 100 ALL
```

Fields should include:

* id
* tenant_id
* product_id
* week_start
* week_end
* price
* available_quantity
* minimum_quantity
* maximum_quantity
* published
* order_deadline
* created_at
* updated_at

Consider whether the price should be stored on weekly availability rather than only on the product.

It SHOULD be possible for a farmer to change the price from one week to another.

Historical orders must preserve the price that was actually paid.

---

# 9. Orders

An order belongs to:

* tenant/farmer
* customer

Fields:

* id
* tenant_id
* customer_id
* order_number
* week_start
* status
* subtotal
* delivery_fee
* total
* notes
* delivery_address
* customer_phone
* created_at
* updated_at

Order status:

```text
DRAFT
PLACED
CONFIRMED
PREPARING
READY
DELIVERED
CANCELLED
```

Do not overcomplicate order states.

---

# 10. Order Items

Fields:

* id
* order_id
* product_id
* product_name_snapshot
* unit_snapshot
* quantity
* unit_price
* total_price

Important:

Store product name and price snapshots.

If the farmer changes:

```text
Tomatoes: 250 ALL → 300 ALL
```

old orders must still show the original price.

---

# 11. Customer Experience

The customer experience should be extremely simple.

The main page should communicate:

> **This week's fresh products**

Display product cards:

```text
🍅 Tomatoes

250 ALL / kg

Available this week

[-] 2 kg [+]

[Add]
```

The customer should be able to:

1. Browse products
2. Select quantities
3. See cart
4. Confirm order
5. Enter/select delivery information
6. Submit order
7. See confirmation

Do not require customers to navigate through many screens.

---

# 12. Repeat Last Order

This is an important feature.

Customers often buy similar products every week.

Provide:

> **Repeat last week's order**

Example:

```text
Your last order

Tomatoes       5 kg
Cucumbers      2 kg
Lettuce        3
Apples         2 kg

[Repeat order]
```

If a product is no longer available, clearly show:

```text
Apples — no longer available
```

and allow the customer to continue with the rest.

---

# 13. Farmer Dashboard

The farmer dashboard is the most important business interface.

It should prioritize simplicity over visual complexity.

Main dashboard:

```text
THIS WEEK

Orders
37

Products
12

Expected sales
146,500 ALL

[Manage this week's products]

[View orders]
```

---

# 14. Weekly Product Management

The farmer should be able to create the week's availability quickly.

Example:

```text
THIS WEEK

Tomatoes
Available: [100] kg
Price: [250] ALL/kg
✓ Published

Cucumbers
Available: [50] kg
Price: [180] ALL/kg
✓ Published

Lettuce
Available: [80] pieces
Price: [100] ALL
✓ Published
```

Make it possible to copy the previous week's products:

```text
[Copy last week]
```

Then the farmer only changes quantities and prices.

This should be one of the fastest workflows in the application.

---

# 15. Farmer Order Management

The farmer needs two different views.

## A. Aggregated view

This is extremely important.

Example:

```text
THIS WEEK'S TOTALS

Tomatoes       43 kg
Cucumbers      27 kg
Lettuce        31 pcs
Apples         18 kg
Cheese          9 kg
```

The farmer needs to know:

> "How much do I need to prepare?"

This is more important than seeing individual orders first.

---

## B. Individual orders

Example:

```text
Order #1042

Customer: Sokol Kreshpa
Phone: ...

Tomatoes       5 kg
Cucumbers      2 kg
Lettuce        3 pcs

Total: 2,450 ALL

Status: CONFIRMED

[Mark as Preparing]
```

---

# 16. Delivery / Pickup

Do not build a sophisticated logistics system initially.

Support simple options:

```text
DELIVERY
PICKUP
```

Customer can provide:

* address
* phone
* delivery notes

The farmer can see this information with the order.

Later the system can evolve into delivery zones and delivery scheduling.

---

# 17. Notifications

Design the system so notifications can be added cleanly.

For the MVP, consider:

### Customer

When:

* order placed
* order confirmed
* order ready
* order delivered

### Farmer

When:

* new order received

Initially email notifications are acceptable.

Do not build a complex notification microservice.

Create a notification abstraction so additional channels can later be added:

```text
Email
SMS
WhatsApp
Push notification
```

---

# 18. Public Farmer Page

Each farmer should eventually have a public page.

Example:

```text
yourapp.com/f/farm-a
```

Page:

```text
Farm A

Fresh local produce
Harvested weekly

[Products]

[How ordering works]

[About the farm]
```

Customers should be able to access the ordering interface from this page.

Design the routing so that custom domains or subdomains can be added later.

---

# 19. UI/UX Requirements

The application must be:

* mobile-first
* fast
* clean
* simple
* accessible
* usable by people who are not technically sophisticated

Avoid:

* unnecessary animations
* complex dashboards
* excessive menus
* excessive configuration
* technical terminology

The customer should be able to place a weekly order in under 2–3 minutes.

The farmer should be able to publish the next week's availability in under 5 minutes.

---

# 20. Design Direction

Use a modern, trustworthy agricultural aesthetic.

The design should communicate:

* local
* fresh
* trustworthy
* natural
* simple
* premium but not expensive

Do NOT make it look like a generic supermarket/e-commerce template.

Use high-quality typography, whitespace, product photography and simple cards.

Use shadcn/ui components where appropriate.

---

# 21. Security

Implement proper security from the beginning.

Requirements:

* Supabase Auth
* Row Level Security
* Tenant isolation
* Server-side authorization
* Input validation using Zod
* No trust in client-provided tenant IDs
* Validate ownership before reading/writing tenant data
* Protect farmer/admin routes
* Do not expose service-role credentials to the browser
* Use environment variables for secrets

Create tests specifically verifying that:

```text
Farmer A cannot access Farmer B's products.
Farmer A cannot access Farmer B's orders.
Customer A cannot access Customer B's private order.
```

---

# 22. Project Structure

Use a clean modular structure.

A possible structure:

```text
app/
  (public)/
  (customer)/
  (farmer)/
  (admin)/
  api/

components/
  ui/
  products/
  orders/
  farmer/
  customer/

lib/
  auth/
  db/
  products/
  orders/
  tenants/
  notifications/
  validation/

types/

tests/
  unit/
  e2e/
```

Do not force this exact structure if Next.js conventions suggest a better organization.

The important principle is separation of concerns.

---

# 23. Development Process

Follow this process.

## Phase 1 — Architecture

Before writing significant application code:

1. Analyze the requirements.
2. Identify entities.
3. Design database schema.
4. Define relationships.
5. Define authentication and authorization.
6. Define tenant isolation.
7. Define application routes.
8. Define core user flows.
9. Identify potential future scalability problems.
10. Document architectural decisions.

Create:

```text
docs/architecture.md
docs/database.md
docs/user-flows.md
```

Do not over-engineer.

---

# 24. Phase 2 — Database

Implement:

* Supabase project configuration
* PostgreSQL schema
* migrations
* indexes
* constraints
* RLS policies
* seed data

Create realistic seed data for:

* one farmer
* 10–15 products
* several customers
* one current weekly availability
* several orders

---

# 25. Phase 3 — Authentication

Implement:

* customer registration/login
* farmer login
* admin login
* session management
* protected routes
* role-based access
* tenant isolation

---

# 26. Phase 4 — Customer MVP

Implement:

1. Farmer public page
2. Weekly product list
3. Product selection
4. Cart
5. Checkout
6. Order confirmation
7. Order history
8. Repeat previous order

Make this workflow fully functional before adding advanced functionality.

---

# 27. Phase 5 — Farmer MVP

Implement:

1. Farmer dashboard
2. Product management
3. Weekly availability management
4. Copy previous week
5. Order list
6. Aggregated order quantities
7. Individual order details
8. Order status management

The aggregated order view is a high-priority feature.

---

# 28. Phase 6 — Notifications

Implement email notifications for:

* new order → farmer
* order confirmation → customer
* order status changes → customer

Keep notification logic modular.

---

# 29. Phase 7 — Testing

Write tests for:

### Authentication

* login
* logout
* protected routes

### Tenant isolation

* farmer A cannot see farmer B data

### Orders

* create order
* calculate totals
* preserve historical prices
* prevent ordering unavailable products
* prevent exceeding available quantities if inventory enforcement is enabled

### Customer

* repeat previous order
* unavailable products handled correctly

### Farmer

* weekly availability
* aggregation
* order status

Use Playwright for critical end-to-end flows.

---

# 30. Phase 8 — Deployment

Configure:

* GitHub
* Vercel
* Supabase
* environment variables
* production database
* preview deployments

Create:

```text
.env.example
```

Never commit secrets.

Verify the application works correctly on Vercel.

---

# 31. Important Future Architecture Considerations

Do NOT implement these now unless required, but ensure the architecture does not prevent them.

Future possibilities:

### Multiple farmers

```text
Farmer A
Farmer B
Farmer C
```

### Marketplace

Customers can discover multiple farmers.

### Multiple farms per farmer/company

A farmer organization may have several farms.

### Subscription boxes

Example:

> Weekly vegetable box — €25

### Recurring orders

Customer automatically orders every week.

### Delivery zones

Different delivery fees by location.

### Payments

Stripe or another payment provider.

### SMS / WhatsApp

Order notifications.

### Farm traceability

Product:

```text
Farm
→ field
→ harvest date
→ batch
→ customer
```

### Product origin information

Show customers:

* farm
* region
* harvest date
* growing method
* certifications
* batch information

### AI assistant

Eventually customers could say:

> "Create my weekly vegetable order for 4 people."

The AI can construct a basket from the farmer's available products.

Do not build this now.

---

# 32. What NOT to Build in the MVP

Do NOT initially build:

* marketplace
* complex delivery fleet management
* AI chatbot
* recommendation engine
* loyalty system
* advanced analytics
* microservices
* mobile native applications
* complex payment infrastructure
* multi-language CMS
* complicated subscription billing
* advanced inventory forecasting

The first objective is:

> **Replace the farmer's messy email-based weekly ordering process with a simple structured ordering workflow.**

---

# 33. Development Rules

While developing:

1. First understand the existing code before modifying it.
2. Do not create duplicate functionality.
3. Keep components small and reusable.
4. Avoid premature abstraction.
5. Keep business logic out of UI components.
6. Use TypeScript strictly.
7. Avoid `any` unless absolutely necessary.
8. Validate all external input.
9. Prefer server-side authorization.
10. Write migrations rather than manually modifying production databases.
11. Keep commits logically separated.
12. Run tests and linting after significant changes.
13. Fix errors rather than suppressing them.
14. Do not add dependencies without a reason.
15. Keep the MVP small.

---

# 34. Start Here

Before implementing the application, produce the following:

### A. Architecture overview

Explain:

* frontend
* backend
* database
* authentication
* authorization
* tenant isolation
* deployment

### B. Entity relationship diagram

Show:

```text
Tenant
  |
  +-- Products
  |
  +-- Weekly Availability
  |
  +-- Customers
  |
  +-- Orders
          |
          +-- Order Items
```

### C. Database schema

Provide all tables, fields, types, relationships, indexes and constraints.

### D. RLS strategy

Explain exactly how tenant isolation will work.

### E. Application routes

Define routes for:

```text
Public
Customer
Farmer
Admin
API
```

### F. Core user flows

Document:

1. Customer places weekly order
2. Farmer publishes weekly availability
3. Farmer views aggregated orders
4. Farmer processes an order
5. Customer repeats previous order

### G. Then implement

After producing the architecture, **stop and ask the product owner to review it** before writing migrations. Once approved, implement the application incrementally, phase by phase.

Do not stop at architecture documentation — build the working MVP.

At the end of each major phase:

* run tests
* run lint
* verify TypeScript
* fix errors
* summarize what was implemented
* identify the next phase

The final result should be a **working, deployable, production-quality MVP**, not just a prototype or a collection of UI screens.
