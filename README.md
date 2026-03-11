## VeriVault

Flagship Grade Certificate Verification System

Local demo app for certificate verification.

## Features

- 🔐 Secure certificate verification
- 📤 Bulk certificate upload (Excel/CSV)
- 🔍 Fast certificate search
- 📱 QR code generation for certificates
- 🎨 Beautiful, modern UI with dark mode
- 👨‍💼 Admin dashboard with full CRUD operations

## Local Development

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Setup

1. Install dependencies:
```bash
npm install
```

2. Run the development server (frontend + backend):
```bash
npm run dev:full
```

This will start:
- Frontend dev server on `http://localhost:5173` (or next available port)
- Backend API server on `http://localhost:8787`

### Alternative: Run separately

**Frontend only:**
```bash
npm run dev
```

**Backend only (using Wrangler):**
```bash
npm run dev:server
```

**Backend only (using local Node server):**
```bash
npm run dev:local
```

### Default Login Credentials

- Email: `admin@verivault.com`
- Password: `admin123`

You can change these by setting environment variables:
- `ADMIN_EMAIL` - Admin email
- `ADMIN_PASSWORD` - Admin password

### API Endpoints

- `GET /api/certificates/verify/:id` - Verify a certificate (public)
- `GET /api/certificates` - Get all certificates (admin)
- `POST /api/certificates` - Create certificate (admin)
- `POST /api/certificates/bulk` - Bulk create certificates (admin)
- `PUT /api/certificates/:id` - Update certificate (admin)
- `DELETE /api/certificates/:id` - Delete certificate (admin)
- `GET /api/certificates/search?q=query` - Search certificates (admin)
- `POST /api/auth/login` - Admin login
- `POST /api/admin/api-keys` - Create a new API key (admin only)
- `GET /api/admin/api-keys` - List all API keys (admin only)
- `DELETE /api/admin/api-keys/:id` - Revoke an API key (admin only)
- `GET /api/public/certificates/:id` - Public certificate lookup using API key

### Building for Production

```bash
npm run build
```

## Project Structure

- `src/react-app/` - React frontend application
- `src/worker/` - Cloudflare Worker backend API
- `src/shared/` - Shared types between frontend and backend
- `src/react-app/components/` - React components
- `src/react-app/pages/` - Page components
- `src/react-app/lib/` - Utility functions and API client

## Technologies Used

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS, Framer Motion
- **Backend**: Hono, Cloudflare Workers, D1 Database
- **UI Components**: Radix UI, Lucide Icons
- **Other**: QR Code generation, PDF export, Excel/CSV parsing
