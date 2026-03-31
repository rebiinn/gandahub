# PROJECT PROPOSAL
# COSMETICS E-COMMERCE SYSTEM
## "Ganda Hub Cosmetics"

---

## I. Functional Requirements

Functional requirements describe the specific features and services the system must provide to users and administrators.

### 1. User Management

- User registration and login for **customers**, **administrators**, **riders**, and **suppliers** (store vendors)
- **Forgot password** and **reset password** via secure token flow (requires configured outbound email in production)
- **Continue with Google** (OAuth 2.0) as an alternative sign-in path, subject to backend credential configuration
- User profile management (personal information, **change password**, account preferences)
- **Saved delivery addresses**: multiple addresses per customer, default address selection for checkout and profile
- Role-based access control (**Admin**, **Customer**, **Rider**, **Supplier**), enforced in the API and in separate web portals (storefront, `/admin`, `/rider`, `/supplier`)

### 2. Product Management

- Product browsing by category (Face, Lips, Eyes, Skincare, etc.)
- Product search and filtering by price, brand, popularity, and related storefront metadata
- Product detail pages with images, descriptions, prices, stock indicators, and reviews
- **Multi-vendor stores**: products may belong to a **store**; customers can browse a **vendor storefront** by store slug (marketplace-style pages in addition to the global catalog)
- Promotional product display (featured products, on-sale and new-arrivals sections, discount codes / vouchers)

### 3. Shopping and Order Processing

- Shopping cart management (add, update quantity, remove items, coupon application)
- **Wishlist** for signed-in customers
- Secure checkout and online payment processing
- Order confirmation and notifications where configured (email depends on mail settings)
- Order and **delivery tracking** for customers (order number and delivery tracking where supported)

### 4. Inventory Management

- Real-time or near–real-time inventory tracking at product level, including fields suitable for **warehouse** and **supplier-facing** stock where applicable
- Automatic stock consumption after successful orders and reconciliation paths for administrators
- Low-stock awareness for administrative and supplier workflows
- **Stock requests**: administrators can request additional stock from suppliers; suppliers can **fulfill** or **decline** requests through the system
- **Inventory receipts**: administrative record of goods received (audit trail linking products, suppliers, quantities, and receipt dates)

### 5. Delivery and Logistics

- Delivery management: assign riders, view delivery pipeline, update status
- Rider dashboard and delivery list scoped to assigned work
- Delivery status updates through the lifecycle (e.g. out for delivery, delivered)
- **Rider location updates** during active deliveries where the product supports it
- **Post-delivery feedback**: customers may **rate the rider** associated with an order

### 6. Administrative Functions

- Admin dashboard with analytics and operational KPIs
- **Store management**: create and manage vendor stores; associate suppliers; remove stores when required
- Product, category, pricing, and **inventory** management (including stock adjustments and release flows as implemented)
- **Stock requests** creation and oversight; visibility into **inventory receipts**
- Order, payment, and delivery management (status changes, cancellations, refunds where implemented)
- User management across roles (including suppliers and riders as applicable)
- **Reviews moderation**: approve or reject customer reviews before or after publication, per business rules
- **Newsletter**: view and export subscriber data from public signup
- System settings, public storefront configuration, and **database backup** utilities where exposed in the admin UI
- Reports generation (sales, inventory, revenue, dashboard summaries, etc.)

### 7. Supplier (Vendor) Functions

- Dedicated **supplier portal** (`/supplier`) isolated from customer and admin UIs
- Dashboard and metrics scoped to the supplier’s store
- Manage **own products** and **stock** (within permissions enforced by the API)
- Respond to **stock requests** from administration (fulfill / decline as allowed)
- **Messaging** with customers who initiate or participate in conversations
- **Moderate reviews** pending for their own products (approve / reject where the workflow applies)

### 8. Customer Engagement & Communication

- Customer **product reviews** and ratings; helpful-vote or similar engagement on reviews where implemented
- Promotional features: vouchers and **coupon codes**
- **In-app messaging** between customers and suppliers (conversation threads)
- **In-app notifications** for relevant events (e.g. stock request outcomes, order-related updates)
- **Newsletter subscription** on the public site

---

## II. Non-Functional Requirements

Non-functional requirements define the quality attributes of the system.

### 1. Performance

- Pages must load within 3 seconds under normal network conditions
- The system must handle high concurrent user traffic

### 2. Usability

- Mobile-responsive design for all device sizes
- Intuitive and user-friendly interface
- Standardized error handling and clear user feedback messages

### 3. Security

- Secure data encryption using SSL/HTTPS in production
- Prudent handling of payment flows and sensitive data in line with platform and card-scheme expectations
- **Authenticated API** using JWT for protected routes; strict **role-based access control** (Admin, Customer, Rider, Supplier) and route-level authorization so suppliers access only their store’s data
- OAuth (Google) implemented with server-side token exchange and callback hardening as provided by the framework
- Password reset tokens time-limited and single-use; passwords stored using standard hashing (not plaintext)

### 4. Reliability & Availability

- System availability of 99.9% uptime
- Automated daily database backups
- Fast recovery from system failures

### 5. Compatibility

- Cross-browser compatibility (Chrome, Safari, Edge)

### 6. Scalability

- Ability to scale system resources as users, products, and transactions increase
- Support for future feature expansion without system redesign; **modular API (versioned under `/api/v1`)** and separation of frontend and backend aid incremental rollout

### 7. Maintainability & Operations

- **Database migrations** ship with the codebase; production releases should apply pending migrations before or during deploy
- **Environment-based configuration** (API URL, database, mail, OAuth secrets) documented in the repository **README** for local and cloud (e.g. Vercel + Railway) setups

---

**Related document:** For stack versions, local quick start, and production environment variables, see [README.md](README.md).
