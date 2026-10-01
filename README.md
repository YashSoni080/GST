# GST Manager (2026 Enterprise Edition)

A comprehensive, tiered full-stack MERN application for managing Goods and Services Tax (GST) compliance designed for the Indian compliance and financial landscape of 2026, implementing the complete specification from [`features.md`](file:///home/yash/Code/Development/Projects/GST/features.md).

---

## Architecture & Tiered Feature Roadmap

### Tier 1: Core & Foundational Features (The Operational Layer)
- **Multi-Entity Master Data Management (Section 2.1)**:
  - Multi-GSTIN & Branch support under single PAN across states with branch-level series and primary designation.
  - Dynamic Vendor & Customer Master: Pulls verified legal names, trade names, registration status, and compliance ratings directly from GSTN portal via live lookup API (`/api/parties/lookup-gstin/:gstin`).
  - HSN/SAC code directory with rate lookup (CGST, SGST, IGST).
- **Invoicing & Billing Engine (Section 2.2)**:
  - Rule 46 compliant document generation for B2B, B2C, SEZ, Deemed Exports, Export with/without tax payment, Credit/Debit Notes, and Delivery Challans.
  - Pre-issuance validation: checks Place of Supply (POS) against state tax rules, mandatory HSN, and recipient GSTIN validity.
  - Dynamic UPI QR Code for B2C invoices and printable Rule 46 tax invoice preview.
- **Statutory Returns Filing (Section 2.3)**:
  - Direct 1-click return auto-compilation for GSTR-1 and GSTR-3B from invoices and purchase registers.
  - Official GSTN 2.0 JSON payload generation & export (`/api/returns/:id/json`).
  - Filing mode support: EVC (Electronic Verification Code with OTP) and DSC simulation with statutory ARN generation.
- **Audit Trails & Activity Logging (Section 2.4)**:
  - Immutable record-keeping for regulatory compliance (Companies Act & GST requirements).

### Tier 2: Intermediate Features (Integration & Efficiency Layer)
- **Real-Time e-Invoicing & e-Way Bill Integration (Section 3.1)**:
  - Direct IRP connectivity: 64-character SHA-256 IRN hash generation and cryptographically signed QR code data URL.
  - Auto-stamping into invoice PDF/view.
  - Concurrent Part-A & Part-B e-Way Bill generation with automated pin code transit distance calculation.
- **Two-Way ERP & Accounting Connectors (Section 3.2)**:
  - Turnkey connector integrations for SAP S/4HANA, Tally Prime, Zoho Books, and Busy.
  - Direct ERP batch file ingestion (CSV/JSON) and Tally XML sales export (`/api/erp/export/tally-xml`).
- **Automated ITC Reconciliation (GSTR-2B vs. Purchase Register) (Section 3.3)**:
  - 4-way matching algorithm: Exact (100%), Approximate (tolerances), Mismatch, and Missing in 2B / Extra in 2B.
  - One-click action triggers: Accept, Reject, Hold, and Provisional Claim.
- **Vendor Communication & Follow-up Portal (Section 3.4)**:
  - Automated discrepancy mailers and alerts dispatched to non-compliant suppliers with blocked tax details.

### Tier 3: Advanced Features (Intelligence, Automation & Governance)
- **AI-Powered Intelligent Document Processing (IDP) (Section 4.1)**:
  - Autonomous OCR parsing of unstructured invoice text/scans.
  - Mathematical integrity verification ($Qty \times Rate = Taxable$; $Taxable \times Rate = Tax$) with 1-click purchase voucher import.
- **Dynamic Rule-Based ITC Optimization Engine (Section 4.2)**:
  - Section 17(5) blocked credit categorization (motor vehicles, catering, personal consumption).
  - Credit Utilization Matrix Optimizer (Section 49A/49B - optimal order of IGST against liabilities to minimize cash outlay via PMT-06).
  - 180-Day Rule 37 Vendor Payment Tracker: detects unpaid bills past 180 days and calculates mandatory ITC reversal + 18% p.a. interest.
- **Automated Annual Return (GSTR-9 & 9C) Builder (Section 4.3)**:
  - Consolidates 12 months GSTR-1, GSTR-3B, GSTR-2B, and trial balance.
  - Table 4 (Outward), Table 6 (ITC), Table 8 (2B vs 3B variance), and recommended DRC-03 voluntary payment report.
- **Automated Notice Management & DRC Compliance Tracker (Section 4.4)**:
  - Lifecycle tracking for ASMT-10, DRC-01, and SCN notices.
  - AI Legal Response Drafting Assistant: generates formal legal submission quoting CBIC circulars (Circular 183/15/2022-GST & 193/05/2023-GST) and Section 16(2).
  - DRC-03 voluntary payment ledger.
- **Risk Assessment & Predictive Audit Radar (Section 4.5)**:
  - Simulates tax department risk scoring models (DGARM / BIFA) with a 0-100 score and risk bands.
  - Anomaly detection (cancellation rate, excess ITC over 2B, odd-hour e-way bills).
  - Circular trading heuristic detector & Supplier Health Scorecard (A+, A, B, C, D).

### Tier 4: Next-Gen 2026 Innovations
- **Real-Time Continuous Transaction Control (CTC) (Section 5.1)**:
  - Zero-batch pre-clearance validation for procurement event streams: verifies active status, credit limit, and risk tier before PO or payment.
- **Conversational Compliance Assistant (LLM-Based) (Section 5.2)**:
  - Natural language query copilot for CFOs and tax managers (e.g. *"What is our unutilized IGST balance?"*, *"Show all vendors with blocked credits"*).
  - Executes real-time data analytics and returns synthesized metrics and interactive tables.
  - Bring-your-own-key cloud engines (Google Gemini 2.5 Flash / OpenAI GPT-4o-mini) with conversation history, or the zero-config built-in tax reasoning engine; the UI always reports which engine actually answered and flags any fallback.
- **In-App GST Calculator**:
  - Add or extract GST from any amount with rate slabs (0% – 28%), custom rates, intra-state (CGST + SGST) vs inter-state (IGST) split, round-off, copyable summary and saved history.
  - Standard keypad calculator with full keyboard support.
- **Automated Escrow & Split-Payment Integration (Section 5.3)**:
  - Invoice split-payment rail: Base amount released immediately to vendor; GST component locked in escrow until verified and matched in subsequent GSTR-2B cycle.

---

## Tech Stack

| Layer    | Technology                          |
| -------- | ----------------------------------- |
| Frontend | React 18, React Router 6, Vite      |
| Backend  | Node.js, Express 4                  |
| Database | MongoDB, Mongoose 8 (Local port 27019) |
| Auth     | JWT (jsonwebtoken + bcryptjs)       |
| QR Engine| qrcode (IRP Signed QR & Dynamic UPI)|
| Styling  | Custom CSS (design-system tokens)   |

---

## Project Structure

```
GST/
├── client/                   # React frontend
│   ├── src/
│   │   ├── api/client.js         # API client (all 2026 endpoints)
│   │   ├── context/AuthContext.jsx # Auth provider + hook
│   │   ├── components/Layout.jsx  # Tiered navigation shell
│   │   └── pages/
│   │       ├── Dashboard.jsx      # Executive overview & Audit Radar dial
│   │       ├── AIAssistant.jsx    # Conversational Compliance Copilot (5.2)
│   │       ├── Calculator.jsx     # GST Calculator + standard keypad
│   │       ├── Invoices.jsx       # Rule 46 Tax Invoices, IRN & EWB (2.2 & 3.1)
│   │       ├── Returns.jsx        # Returns Compiler, EVC Filing & GSTR-9 (2.3 & 4.3)
│   │       ├── Purchases.jsx      # Purchase Register & AI IDP Scanner (4.1)
│   │       ├── Reconciliation.jsx # 4-Way GSTR-2B Matching & Vendor Alerts (3.3 & 3.4)
│   │       ├── ITCOptimizer.jsx   # Credit Matrix, Rule 37 & Sec 17(5) (4.2)
│   │       ├── Parties.jsx        # Dynamic GSTIN Verification Master (2.1)
│   │       ├── AuditRadar.jsx     # Predictive Department Audit Radar (4.5)
│   │       ├── Notices.jsx        # ASMT-10 / DRC-01 & AI Drafter (4.4)
│   │       ├── CTCAndEscrow.jsx   # Continuous Transaction Control & Escrow (5.1 & 5.3)
│   │       ├── CompanySettings.jsx# Multi-GSTIN & ERP Connectors (2.1 & 3.2)
│   │       ├── ITC.jsx            # Ledger Balances
│   │       └── Reports.jsx        # HSN-Wise Sales & Collections
│   └── package.json
├── server/                   # Express backend
│   ├── src/
│   │   ├── index.js              # Entry point & route registration
│   │   ├── config/               # DB, constants, self-healing runner
│   │   ├── middleware/            # Auth, audit, error handling
│   │   ├── models/               # 13 Mongoose models
│   │   ├── routes/               # 16 route modules
│   │   ├── services/             # Tax, IRN, EWB, Returns, ITC, Radar, AI
│   │   └── seed.js               # Multi-tier 2026 demo data seed
│   ├── test/
│   │   └── features.test.js      # Comprehensive feature roadmap test suite
│   └── package.json
├── features.md               # 2026 GST Feature Roadmap Specification
└── package.json              # Workspace root
```

---

## Quick Start

```bash
# Clone
git clone https://github.com/YashSoni080/GST.git
cd GST

# Install dependencies (workspaces)
npm install

# Seed demo data (automatically connects & launches DB)
npm run seed

# Run feature test suite
npm test -w server

# Start server and client concurrently
npm run dev
```

### Demo Credentials
```
Email:    admin@greenshine.com
Password: admin123
```
