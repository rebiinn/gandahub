# WEBSYSTEM Documentation

Comprehensive project documentation for the **Ganda Hub Cosmetics** web system.

---

## Development Frameworks

- **Frontend:** React 18, React Router, Axios, Tailwind CSS, Vite
- **Backend:** Laravel 10 (PHP 8.1+), Eloquent ORM, JWT Auth
- **Database:** MySQL 8.0+

### Tools and Services Used

| Tool | Purpose |
|---|---|
| Railway | Backend API hosting and deployment |
| Cloudinary | Product image storage and delivery |
| Laravel Socialite | Google OAuth login integration |
| Google Cloud Console | OAuth client credentials |
| Laravel Herd / XAMPP | Local PHP + MySQL development |
| Navicat | Optional MySQL database GUI |

---

## Project Structure

```text
websystproj/
|-- backend/                     # Laravel API
|   |-- app/
|   |   |-- Http/Controllers/Api/
|   |   |-- Models/
|   |-- routes/
|   |   |-- api.php
|   |-- database/
|   |-- .env
|   |-- Dockerfile
|   `-- railway.toml
|-- frontend/                    # React + Vite app
|   |-- src/
|   |   |-- pages/
|   |   |-- components/
|   |   |-- services/
|   |   `-- utils/
|   |-- .env
|   `-- vite.config.js
|-- README.md
|-- SYSTEM_DOCUMENTATION.md
`-- PROJECT_DOCUMENTATION.md
```

---

## Installation

### Prerequisites

- PHP 8.1+
- Composer
- Node.js 18+
- npm
- MySQL 8.0+

### Backend Setup

1. Go to backend directory:
   - `cd backend`
2. Install PHP dependencies:
   - `composer install`
3. Copy env file:
   - `cp .env.example .env`
4. Configure database in `.env` (`DB_HOST`, `DB_PORT`, `DB_DATABASE`, `DB_USERNAME`, `DB_PASSWORD`)
5. Generate app key:
   - `php artisan key:generate`
6. Generate JWT secret:
   - `php artisan jwt:secret`
7. Run migrations and seeders:
   - `php artisan migrate --seed`
8. Start backend:
   - `php artisan serve`

### Frontend Setup

1. Go to frontend directory:
   - `cd frontend`
2. Install dependencies:
   - `npm install`
3. Set API URL in `.env`:
   - `VITE_API_URL=http://127.0.0.1:8000/api/v1`
4. Start frontend:
   - `npm run dev`

---

## Features

### Customer Features

- Browse products by category
- Product search and filtering
- Shopping cart management
- Secure checkout process
- Order tracking
- Profile management
- Product reviews

### Admin Features

- Dashboard with analytics
- Product and category CRUD
- Inventory and stock management
- Order and payment management
- Delivery and rider assignment
- Reports generation (sales, inventory, revenue)
- System settings and backup support

### Rider Features

- Delivery dashboard
- View assigned deliveries
- Update delivery status and location
- Mark deliveries as complete

### Supplier Features

- Supplier portal for products and stock
- Supplier-scoped order management
- Delivery handoff and logistics integration
- Customer messaging and review moderation

---

## Default Login Credentials

After seeding the database:

| Role | Email | Password |
|---|---|---|
| Admin | admin@gandahub.com | password123 |
| Rider | rider@gandahub.com | password123 |
| Customer | customer@gandahub.com | password123 |

---

## API Endpoints

Base URL: `/api/v1`

### Authentication

- `POST /register` - Register new user
- `POST /login` - Login
- `POST /logout` - Logout
- `GET /me` - Get current user

### Products

- `GET /products` - List products
- `GET /products/{id}` - Product details
- `GET /products/featured` - Featured products
- `GET /products/on-sale` - Sale products

### Categories

- `GET /categories` - List categories
- `GET /categories/{id}` - Category details

### Cart

- `GET /cart` - Get cart
- `POST /cart/items` - Add cart item
- `PUT /cart/items/{itemId}` - Update cart item
- `DELETE /cart/items/{itemId}` - Remove cart item

### Orders

- `GET /orders` - List user orders
- `POST /orders` - Create order
- `GET /orders/{id}` - Order details
- `GET /orders/track/{orderNumber}` - Track order

### Admin Routes (requires `role:admin`)

- `GET /admin/users` - Manage users
- `GET /admin/products` - Manage products
- `GET /admin/deliveries` - Manage deliveries
- `GET /admin/reports/dashboard` - Dashboard statistics

---

## Security Features

- JWT token-based authentication
- Role-based access control (admin, customer, rider, supplier)
- Password hashing with bcrypt
- CSRF protection (Laravel middleware support)
- SQL injection prevention via Eloquent ORM
- XSS protection and validated API payloads
- CORS configuration for frontend/backend domains
- Rate limiting support on API routes

---

## Database Schema (High-Level)

Main entities:

- **users** (admin, customer, rider, supplier)
- **categories**
- **products**
- **carts**
- **cart_items**
- **orders**
- **order_items**
- **payments**
- **deliveries**
- **reviews**
- **reports**
- **system_settings**

---

## Quality Attributes (ISO/IEC 25010)

- **Functional Suitability:** Complete e-commerce flow
- **Performance Efficiency:** Optimized API queries and caching-ready design
- **Compatibility:** Responsive UI across devices and browsers
- **Usability:** Simple and intuitive UI/UX
- **Reliability:** Structured validation and error handling
- **Security:** JWT auth, encryption, and role checks
- **Maintainability:** Modular frontend and controller-based backend architecture
- **Portability:** Docker-ready backend and cloud deployment support

---

## Coupon Codes

The following sample coupon codes are available for testing:

- `WELCOME10` - 10% off
- `SAVE20` - 20% off
- `GANDA15` - 15% off

---

## License

This project is licensed under the MIT License.

## Contributing

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/your-feature`
3. Commit changes: `git commit -m "Add your feature"`
4. Push branch: `git push origin feature/your-feature`
5. Open a Pull Request
