# VeriVault - Local Development Setup Guide

## Quick Start

1. **Install Dependencies**
   ```bash
   npm install --legacy-peer-deps
   ```

2. **Start Development Servers**

   **Option A: Run both frontend and backend together (Recommended)**
   ```bash
   npm run dev:full
   ```
   This starts:
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:8787

   **Option B: Run separately**
   
   Terminal 1 (Backend):
   ```bash
   npm run dev:server
   ```
   
   Terminal 2 (Frontend):
   ```bash
   npm run dev
   ```

## Default Login Credentials

- **Email**: `admin@verivault.com`
- **Password**: `admin123`

## Features Now Working

✅ **Home Page**
- Navigation buttons work
- Links to Verify and Login pages

✅ **Verify Page**
- Certificate verification by ID
- QR code verification (via URL parameter)
- Real-time validation

✅ **Login Page**
- Authentication with backend API
- Error handling
- Redirects to admin dashboard

✅ **Admin Dashboard**
- Upload certificates (Excel/CSV bulk upload)
- Search certificates
- View all certificates
- Delete certificates
- Command palette (Ctrl+K / Cmd+K)
- Logout functionality

## API Endpoints

All API endpoints are prefixed with `/api`:

- `POST /api/auth/login` - Admin login
- `GET /api/certificates/verify/:id` - Verify certificate (public)
- `GET /api/certificates` - Get all certificates (admin)
- `POST /api/certificates` - Create certificate (admin)
- `POST /api/certificates/bulk` - Bulk create (admin)
- `PUT /api/certificates/:id` - Update certificate (admin)
- `DELETE /api/certificates/:id` - Delete certificate (admin)
- `GET /api/certificates/search?q=query` - Search (admin)

## Troubleshooting

### Port Already in Use
If port 5173 or 8787 is already in use:
- Frontend: Vite will automatically use the next available port
- Backend: Change port in `wrangler.json` or use `wrangler dev --port 8788`

### API Connection Issues
- Make sure backend is running before starting frontend
- Check that proxy is configured in `vite.config.ts`
- Verify API_BASE environment variable if using custom setup

### Database Issues
- For local development, Wrangler uses a local D1 database
- Data persists in `.wrangler/state/` directory
- To reset: Delete `.wrangler/state/` folder

## Building for Production

```bash
npm run build
```

This creates optimized production builds in the `dist/` directory.

## Environment Variables

You can set these environment variables:

- `ADMIN_EMAIL` - Admin email (default: admin@verivault.com)
- `ADMIN_PASSWORD` - Admin password (default: admin123)
- `VITE_API_BASE` - API base URL (default: /api)

Deployment notes

- Backend: recommended to deploy to Railway using the provided `Dockerfile.server`. Add the required env vars from `.env.example` to Railway project settings. Use the `backend-image` artifact from CI or build the image directly on Railway.
- Frontend: recommended to deploy to Vercel. The frontend uses Vite; set the build command to `npm run build` and the output directory to `dist`.

CI

The repository contains a GitHub Actions workflow at `.github/workflows/ci.yml` which will build the frontend and backend and produce a Docker image artifact for the backend. Configure secrets for automated deploy if desired.

## Notes

- The project uses Cloudflare Workers for the backend
- Local development uses Wrangler's dev server
- Database is D1 (SQLite) - managed by Wrangler locally
- All UI components are functional and connected to the backend
