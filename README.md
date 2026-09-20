# GST Manager

A full-stack MERN application for managing GST compliance — e-invoices, GSTR filing, ITC reconciliation, purchase registers, and party management.

## Features

- **E-Invoice Management** — Create tax invoices with line items, auto-compute CGST/SGST/IGST, push to IRP, cancel invoices
- **GSTR Filing** — GSTR-1 and GSTR-3B return preparation, validation, and submission tracking
- **ITC Ledger** — Input tax credit availed, utilized, expired, and reversed entries
- **Purchase Register** — Record vendor bills, track ITC eligibility, blocked credits
- **ITC Reconciliation** — Match purchase register against GSTR-2B supplier documents, flag mismatches
- **Party Management** — GSTIN master with validation, risk scoring, state-wise classification
- **HSN Code Database** — Searchable HSN/SAC codes with GST rate lookup
- **Dashboard** — Turnover stats, tax liability charts, filing status overview
- **Audit Trail** — Full audit log of all actions with user, IP, and timestamp
- **Role-Based Access Control** — Admin, Accountant, Data Entry, Auditor roles with granular permissions

## Tech Stack

| Layer    | Technology                          |
| -------- | ----------------------------------- |
| Frontend | React 18, React Router 6, Vite      |
| Backend  | Node.js, Express 4                  |
| Database | MongoDB, Mongoose 8                 |
| Auth     | JWT (jsonwebtoken + bcryptjs)       |
| Styling  | Custom CSS (design-system tokens)   |

## Project Structure

```
GST/
├── client/                   # React frontend
│   ├── src/
│   │   ├── api/client.js         # API client (fetch wrapper)
│   │   ├── context/AuthContext.jsx # Auth provider + hook
│   │   ├── components/Layout.jsx  # Sidebar + topbar shell
│   │   └── pages/
│   │       ├── Login.jsx
│   │       ├── Dashboard.jsx
│   │       ├── Invoices.jsx
│   │       ├── Returns.jsx
│   │       ├── Purchases.jsx
│   │       ├── ITC.jsx
│   │       ├── Parties.jsx
│   │       └── Reports.jsx
│   ├── vite.config.js
│   └── package.json
├── server/                   # Express backend
│   ├── src/
│   │   ├── index.js              # Entry point
│   │   ├── config/               # DB, constants, env
│   │   ├── middleware/            # Auth, audit, error handling
│   │   ├── models/               # 11 Mongoose models
│   │   ├── routes/               # 10 route modules
│   │   └── services/             # Tax calc, GSTIN validation, HSN
│   ├── .env.example
│   └── package.json
└── package.json              # Workspace root
```

## Getting Started

### Prerequisites

- Node.js >= 18
- MongoDB running locally (or a connection URI)

### Setup

```bash
# Clone
git clone https://github.com/YashSoni080/GST.git
cd GST

# Install dependencies (workspaces)
npm install

# Configure environment
cp server/.env.example server/.env
# Edit server/.env with your MongoDB URI and JWT secret

# Seed demo data (optional)
npm run seed

# Start both server and client
npm run dev
```

The server runs on `http://localhost:5000` and the client on `http://localhost:5173`.

### Demo Credentials

After running the seed script:

```
Email:    admin@greenshine.com
Password: admin123
```

## API Endpoints

| Method | Endpoint              | Description              | Auth     |
| ------ | --------------------- | ------------------------ | -------- |
| POST   | `/api/auth/register`  | Register new user        | Public   |
| POST   | `/api/auth/login`     | Login                    | Public   |
| GET    | `/api/auth/me`        | Get current user         | Required |
| GET    | `/api/dashboard`      | Dashboard stats          | Required |
| GET    | `/api/invoices`       | List invoices            | Required |
| POST   | `/api/invoices`       | Create invoice           | Required |
| PATCH  | `/api/invoices/:id`   | Update invoice           | Required |
| POST   | `/api/invoices/:id/cancel` | Cancel invoice      | Required |
| GET    | `/api/parties`        | List parties             | Required |
| POST   | `/api/parties`        | Create party             | Required |
| PATCH  | `/api/parties/:id`    | Update party             | Required |
| GET    | `/api/purchases`      | List purchases           | Required |
| POST   | `/api/purchases`      | Record purchase          | Required |
| GET    | `/api/returns`        | List GSTR returns        | Required |
| POST   | `/api/returns`        | Create return            | Required |
| POST   | `/api/returns/:id/submit` | Submit return        | Required |
| GET    | `/api/itc`            | List ITC entries         | Required |
| GET    | `/api/hsn`            | Search HSN codes         | Required |
| GET    | `/api/recon`          | List recon runs          | Required |
| POST   | `/api/recon`          | Run reconciliation       | Required |
| GET    | `/api/audit`          | List audit logs          | Required |

## Data Models

- **User** — Name, email, role, company, active status
- **Company** — Legal name, PAN, GSTINs (multi-GSTIN support), fiscal year
- **Party** — Customer/vendor with GSTIN, state, type, ITC risk scoring
- **Invoice** — Full tax invoice with items, GST breakdown, IRN, EWB, cancellation
- **Purchase** — Vendor bill with ITC eligibility, recon status
- **HSNCode** — HSN/SAC with rate, reverse charge, exempt flags
- **GSTR** — GSTR-1/3B/2B return with status, summary, filed ARN
- **ITCEntry** — Availed/utilized/refund/expired/reversed entries
- **SupplierDoc** — GSTR-2B/IMS documents for reconciliation
- **ReconRun** — Reconciliation run with matched/mismatched/missing summary
- **AuditLog** — Action log with user, entity, IP, timestamp

## License

MIT
