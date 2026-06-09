# Credentials & Environment Setup Guide

## Overview
This project uses environment variables to manage sensitive credentials. Never commit `.env` file to version control.

## Files Included

- **`.env`** - Local configuration (NOT tracked by git, kept only on your machine)
- **`.env.example`** - Template showing what environment variables are needed (tracked by git)
- **`backend_etl/requirements.txt`** - Python dependencies including `python-dotenv`

## Setup Instructions

### 1. Local Development Setup

#### Frontend & Backend ETL
```bash
# Install dependencies
bun install
pip install -r backend_etl/requirements.txt

# Copy .env.example to .env and fill in your actual values
cp .env.example .env
```

Then edit `.env` with your actual credentials:
```env
KOBO_TOKEN=your_actual_token_here
ASSET_UID=your_actual_uid_here
DB_PASSWORD=your_actual_password_here
```

### 2. Environment Variables

#### **Backend ETL** (`backend_etl/kobo_to_mysql_etl.py`)
Reads from:
- `KOBO_TOKEN` - KoboToolbox API token
- `ASSET_UID` - Form UID from KoboToolbox
- `DB_USER` - Database username (default: "root")
- `DB_PASSWORD` - Database password (REQUIRED)
- `DB_HOST` - Database host (default: "localhost")
- `DB_PORT` - Database port (default: "3306")
- `DB_NAME` - Database name (default: "me_monitoring_db")

#### **Frontend** (Vite/React)
Reads from:
- `VITE_KOBO_TOKEN` - Exposed to frontend (used for client-side API calls)
- `VITE_KOBO_ASSET_UID` - Exposed to frontend

### 3. Git & GitHub Deployment

#### Before Pushing to GitHub
```bash
# Ensure .env is not tracked
git rm --cached .env  # If accidentally committed
git status  # Verify .env is ignored
```

#### On GitHub Actions or Remote Deployment
Set environment variables as GitHub Secrets:
1. Go to Repository → Settings → Secrets and variables → Actions
2. Add these secrets:
   - `KOBO_TOKEN`
   - `ASSET_UID`
   - `DB_PASSWORD`
   - `DB_USER`
   - `DB_HOST`
   - `DB_PORT`
   - `DB_NAME`

Then in your deployment workflow (`.github/workflows/*.yml`):
```yaml
env:
  KOBO_TOKEN: ${{ secrets.KOBO_TOKEN }}
  ASSET_UID: ${{ secrets.ASSET_UID }}
  DB_PASSWORD: ${{ secrets.DB_PASSWORD }}
  DB_USER: ${{ secrets.DB_USER }}
  DB_HOST: ${{ secrets.DB_HOST }}
  DB_PORT: ${{ secrets.DB_PORT }}
  DB_NAME: ${{ secrets.DB_NAME }}
```

### 4. Python Backend Deployment

The `backend_etl/kobo_to_mysql_etl.py` script requires:
1. Python 3.8+ with dependencies from `requirements.txt`
2. Environment variables set
3. Network access to:
   - KoboToolbox API (`https://kf.kobotoolbox.org`)
   - MySQL database

**Note:** This cannot run on Cloudflare Workers (no Python support). Deploy separately on:
- AWS Lambda (Python runtime)
- Vercel Functions (Node.js wrapper around Python)
- Heroku/Railway (Python app)
- EC2/VPS with cron job
- GitHub Actions scheduled workflow

### 5. Validation

To test that environment variables are loaded correctly:
```bash
# Frontend
npm run dev  # Should load VITE_* variables

# Backend ETL
cd backend_etl
python kobo_to_mysql_etl.py  # Should load KOBO_TOKEN, ASSET_UID, DB_* variables
```

## Security Checklist

- ✅ `.env` is in `.gitignore`
- ✅ Credentials loaded from environment variables, not hardcoded
- ✅ `.env.example` provided for reference (with dummy values)
- ✅ `.lovable/` added to `.gitignore` (Lovable metadata)
- ✅ Sensitive data never committed to git history

## Removing Accidentally Committed Secrets

If you previously committed `.env` with real credentials:

```bash
# Clean up git history (nuclear option)
git filter-branch --force --index-filter \
  'git rm --cached --ignore-unmatch .env' \
  --prune-empty --tag-name-filter cat -- --all

# Force push to GitHub (dangerous, coordinate with team)
git push origin --force --all
git push origin --force --tags

# Then rotate all credentials in KoboToolbox and databases
```

**Recommended:** Just rotate your credentials immediately and assume they've been exposed.
