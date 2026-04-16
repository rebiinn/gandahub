# Ganda Hub Cosmetics - E-Commerce System

A modern, full-stack e-commerce web application for cosmetics and beauty products built with React (Frontend) and Laravel (Backend API).

> **📄 Project Proposal:** See [PROJECT_PROPOSAL.md](PROJECT_PROPOSAL.md) for the full functional and non-functional requirements document.

## System Documentation

To understand how the frontend, backend, and the order pipeline fit together, see:
- `SYSTEM_DOCUMENTATION.md` (one-file “all in one” documentation)

## Requirements

- **Backend:** PHP **8.1 or newer** (Laravel 10 and Composer require `^8.1`). If you see *"Composer detected issues in your platform"*, see [backend/PHP_SETUP.md](backend/PHP_SETUP.md) for Windows setup, upgrade PHP via [php.net](https://www.php.net/downloads), or use a version manager (e.g. [Laravel Herd](https://herd.laravel.com)).
- **Frontend:** Node.js 18+ and npm.
- **Database:** MySQL (or use Railway/cloud DB; see Production setup below).

## Local development (quick start)

1. **Backend:** From `backend/`, copy `.env.example` to `.env`, set `APP_KEY` (`php artisan key:generate`), database credentials, `JWT_SECRET`, and `FRONTEND_URL` (e.g. `http://localhost:5173`). Run migrations: `php artisan migrate` (and optional `php artisan db:seed`). Start the API: `php artisan serve` (default `http://127.0.0.1:8000`).
2. **Frontend:** From `frontend/`, set `VITE_API_URL` in `.env` to your API base with version, e.g. `http://127.0.0.1:8000/api/v1`. Run `npm install` then `npm run dev`. Production builds run `write-config.js` so `public/config.json` gets `apiUrl` from `VITE_API_URL`; in dev, Vite reads the env variable directly.
3. **Optional:** Configure `MAIL_*` in the backend `.env` if you use forgot-password / email flows. For **Continue with Google**, set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and ensure the redirect URI matches `GOOGLE_REDIRECT_URI` in `.env`.

## GCash Auto-Confirm Setup (PayMongo)

Use this if you want fully automatic confirmation after GCash payment (no manual confirm button).

1. In `backend/.env`, set:
   - `PAYMONGO_SECRET_KEY=...` (your PayMongo secret key)
   - `PAYMONGO_VERIFY_SSL=true` (set `false` only for local SSL troubleshooting)
   - `FRONTEND_URL=http://localhost:5173` (or your real frontend URL)
2. Expose your local backend with a tunnel (for webhook callbacks), for example:
   - `ngrok http http://127.0.0.1:8000`
3. In PayMongo Dashboard, create a webhook pointing to:
   - `https://<your-ngrok-domain>/api/v1/payments/paymongo/webhook`
4. Subscribe to payment result events:
   - success/paid events (e.g. checkout/session paid)
   - failed/expired events
5. Copy the webhook signing secret from PayMongo and set:
   - `PAYMONGO_WEBHOOK_SECRET=...` in `backend/.env`
6. Restart backend after env changes:
   - `php artisan config:clear`
   - `php artisan serve`
7. Test a GCash checkout:
   - Checkout redirects to PayMongo.
   - After payment, you return to `/orders/:id?payment=success`.
   - Order payment status updates automatically once webhook arrives.

Troubleshooting:
- If payment stays `processing`, verify webhook delivery logs in PayMongo Dashboard (expect HTTP 200 from your API).
- Confirm tunnel URL still active (ngrok URLs change on restart unless reserved).
- Check backend logs for webhook mapping/signature warnings.

## Features

### Customer Features
- Browse products by categories; **vendor storefronts** at `/stores/:slug`
- Product search and filtering
- Shopping cart and wishlist
- **Saved delivery addresses** (profile / checkout)
- Secure checkout
- **Forgot password** and **reset password** (email depends on `MAIL_*` configuration)
- **Continue with Google** (OAuth; requires Google credentials on the backend)
- Order history and **order tracking** (including delivery tracking)
- User profile
- Product reviews; **rate rider** after delivery
- **In-app messages** with suppliers (conversations)
- **Notifications** (e.g. stock / fulfillment updates)
- **Newsletter** signup (footer / marketing)

### Admin Features
- Dashboard with analytics
- **Store management** (create vendor stores; assign suppliers)
- Product management (CRUD), categories, **inventory** and warehouse / supply fields
- **Stock requests** to suppliers; **inventory receipts** (audit trail)
- Order and payment management; delivery and rider assignment
- Customer and user management (roles include **supplier**)
- **Reviews** moderation (approve / reject)
- **Newsletter subscribers** list
- Reports (sales, inventory, revenue, etc.)
  - Generate exactly one report type per run (based on selected report card)
  - Generated list is historical (older report runs are kept until deleted)
  - View report details in-app (download/export actions removed from the admin page)
- System settings and database backup support

### Supplier Features (`/supplier` portal)
- Dashboard scoped to the supplier’s store
- **Products** and stock for their catalog
- **Stock requests** from admin (fulfill / decline where applicable)
- **Messages** with customers
- **Reviews** pending approval for their products

### Rider Features
- Delivery dashboard
- View assigned deliveries and update status / location
- Mark deliveries complete



## Production setup (Railway)

For **login, register, and product images** to work in production, set these environment variables for your Railway services.

### Railway (frontend service)

1. In your Railway project, open the **frontend service** → **Variables**.
2. Add:
   - **Name:** `VITE_API_URL`  
   - **Value:** Your Railway backend API URL, e.g. `https://your-app.up.railway.app/api/v1`  
     (Use the **public URL** of your backend service, then add `/api/v1`.)
3. **Redeploy** the frontend service so the new variable is applied. The build writes it into `public/config.json`, and the app loads that at startup.

Without `VITE_API_URL` pointing to your Railway backend (e.g. `https://websystemprojectf-production.up.railway.app/api/v1`), the site will call the wrong API and login/register will fail and products won’t load.

### Railway (backend service)

1. In your Railway project, open the **backend (app) service** → **Variables**.
2. Set:
   - **APP_URL** = your Railway public URL, e.g. `https://your-app.up.railway.app`
   - **FRONTEND_URL** = your Railway frontend URL, e.g. `https://your-frontend.up.railway.app`  
     (Required for CORS and OAuth redirects.)
   - **APP_DEBUG** = `false` in production (so DB/stack traces are not sent to the frontend).
3. **Database (fix "Connection refused"):** The app must reach Railway’s MySQL with the **correct host and port** (not `127.0.0.1`). Recommended:
   - In the **backend service** → Variables → **New Variable** → **Add Variable Reference** → choose **MySQL** → **MYSQL_URL**, and name it **DATABASE_URL**. Redeploy.
   - In deploy logs you should see `DATABASE_URL set: yes`. If you still get "Connection refused", **remove** the variables **DB_HOST**, **DB_PORT**, **DB_DATABASE**, **DB_USERNAME**, **DB_PASSWORD** from the backend service (so Laravel uses only `DATABASE_URL`) and redeploy again.
   - Alternatively, reference or copy **DB_HOST**, **DB_PORT**, **DB_DATABASE**, **DB_USERNAME**, **DB_PASSWORD** from the MySQL service (DB_HOST must be the MySQL hostname Railway shows, not `127.0.0.1`).
4. Set **APP_KEY** and **JWT_SECRET** as needed.
5. **Email (password reset):** For forgot-password links to work in production, configure real **MAIL_*** variables (or a transactional email provider). Local dev can use Mailpit or similar if `MAIL_HOST` points to a test inbox.
6. **New deploys / schema changes:** After pulling code with new migrations, ensure the release runs `php artisan migrate --force`. Use Laravel migrations as the single source of truth for schema updates.

---

## Quality and maintenance notes

- Frontend lint currently passes with **0 errors** (warnings remain for hook dependency recommendations).
- Frontend production build is verified (`npm run build`).
- Backend route boot is verified (`php artisan route:list --path=reports`).
- Backend automated tests may fail to run locally if required PHP extensions are missing (for this environment, `mbstring` is missing).

---

## Deploying backend to Railway

This repo is a monorepo (frontend + backend). To deploy only the **backend** on Railway:

1. In your Railway project, open the backend service.
2. Go to **Settings** → **Build**.
3. **Root Directory:** leave **empty** (so the build context is the full repo).
4. **Dockerfile path** (or variable `RAILWAY_DOCKERFILE_PATH`): set to `backend/Dockerfile` so Railway uses the backend Dockerfile.
5. Redeploy (e.g. trigger a new deployment or push a commit).

The Dockerfile copies `backend` into the image, so the app runs correctly.

### Seeing "0 products" or no product images?

- **If the Products page shows a red error** (e.g. "Could not load products"): the frontend can’t reach the backend. Check that `VITE_API_URL` on your Railway frontend service is your Railway backend URL + `/api/v1`, that the backend service is running, and that you redeployed the frontend after changing env vars.
- **If it says "No products found" with no error**: the database has no products yet. The deploy runs `php artisan migrate --force` and `php artisan db:seed --force` on startup. If the DB was created later or the seed failed, run the seeder manually on Railway:
  1. In Railway, open your backend service.
  2. Use **Settings** → run a one-off command, or open the **Deployments** tab and use the **⋮** menu on a deployment to run a command in the container.
  3. Run: `php artisan db:seed --force`  
  This adds sample categories, products, and users (e.g. admin@gandahub.com / password123). Then refresh the storefront.

---

## Coupon Codes

The following coupon codes are available for testing:
- `WELCOME10` - 10% off
- `SAVE20` - 20% off
- `GANDA15` - 15% off
