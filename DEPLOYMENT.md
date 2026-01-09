# Deployment Guide - BidBook

This guide covers deploying BidBook to Vercel (frontend) and a Python hosting service (backend).

## Project Structure

- **Frontend**: React + Vite (deploy to Vercel)
- **Backend**: FastAPI + Python (deploy to Render/Railway/Fly.io)

## Prerequisites

- GitHub account
- Vercel account (free tier works)
- Backend hosting account (Render, Railway, or Fly.io - all have free tiers)

---

## Step 1: Push to GitHub

```bash
# Initialize git if not already done
cd /Users/ravisuresh/Bridgeline/bridgeline-exercise
git init

# Add all files (except .gitignore)
git add .

# Commit
git commit -m "Initial commit - BidBook ready for deployment"

# Create a new repository on GitHub, then:
git remote add origin https://github.com/YOUR_USERNAME/bidbook.git
git branch -M main
git push -u origin main
```

---

## Step 2: Deploy Backend (FastAPI)

### Option A: Render (Recommended - Easy)

1. Go to [render.com](https://render.com) and sign up
2. Click "New +" → "Web Service"
3. Connect your GitHub repository
4. Configure:
   - **Name**: `bidbook-backend`
   - **Root Directory**: `backend`
   - **Environment**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
   - **Instance Type**: Free (or upgrade for better performance)

5. **Environment Variables** (add in Render dashboard):
   ```
   OPENAI_API_KEY=your-actual-key-here
   FRONTEND_URL=https://your-vercel-app.vercel.app
   ```

6. Render will auto-deploy when you push to main branch

**Backend URL**: `https://bidbook-backend.onrender.com` (or your custom domain)

### Option B: Railway

1. Go to [railway.app](https://railway.app) and sign up
2. Click "New Project" → "Deploy from GitHub repo"
3. Select your repository
4. Add `backend` as the root directory
5. Set environment variables:
   ```
   OPENAI_API_KEY=your-actual-key-here
   FRONTEND_URL=https://your-vercel-app.vercel.app
   ```
6. Railway auto-detects Python and deploys

### Option C: Fly.io (More control)

1. Install Fly CLI: `curl -L https://fly.io/install.sh | sh`
2. In `backend/` directory:
   ```bash
   fly launch
   ```
3. Follow prompts and set environment variables
4. Deploy: `fly deploy`

---

## Step 3: Deploy Frontend (Vercel)

### Method 1: Vercel CLI (Quick)

```bash
# Install Vercel CLI
npm i -g vercel

# Navigate to frontend directory
cd frontend

# Deploy
vercel

# Follow prompts:
# - Link to existing project? No (first time)
# - Project name: bidbook (or your choice)
# - Directory: ./
# - Override settings? No
```

### Method 2: Vercel Dashboard (Recommended)

1. Go to [vercel.com](https://vercel.com) and sign up/login
2. Click "Add New..." → "Project"
3. Import your GitHub repository
4. Click "Edit" next to "Root Directory" and set it to: `frontend`
5. Configure (most are auto-detected):
   - **Framework Preset**: Vite (auto-detected)
   - **Build Command**: `npm run build` (auto-detected)
   - **Output Directory**: `dist` (auto-detected)
   - **Install Command**: `npm install` (auto-detected)

5. **Environment Variables** (click "Environment Variables"):
   ```
   VITE_API_URL=https://your-backend-url.onrender.com
   ```
   - For all environments (Production, Preview, Development)

6. Click "Deploy"

**Frontend URL**: `https://bidbook-xyz.vercel.app` (or your custom domain)

---

## Step 4: Update CORS in Backend

After deploying frontend, update your backend environment variable:

1. Go to your backend hosting dashboard (Render/Railway/Fly.io)
2. Update `FRONTEND_URL` to your actual Vercel URL:
   ```
   FRONTEND_URL=https://bidbook-xyz.vercel.app
   ```
3. Redeploy backend (or it will auto-redeploy)

---

## Step 5: Test Deployment

1. Visit your Vercel frontend URL
2. Try uploading a PDF
3. Check browser console for any CORS errors
4. If errors, verify:
   - Backend `FRONTEND_URL` matches frontend URL exactly
   - Frontend `VITE_API_URL` matches backend URL exactly
   - Both services are deployed and running

---

## Environment Variables Summary

### Backend (.env or hosting dashboard)
```
OPENAI_API_KEY=sk-proj-...your-key...
FRONTEND_URL=https://your-vercel-app.vercel.app
```

### Frontend (Vercel dashboard)
```
VITE_API_URL=https://your-backend.onrender.com
```

---

## Custom Domain (Optional)

### Vercel
1. Go to your project → Settings → Domains
2. Add your domain (e.g., `bidbook.com`)
3. Follow DNS instructions

### Backend
1. Use a custom domain with Render/Railway (requires paid plan)
2. Or keep the free subdomain

---

## Troubleshooting

### CORS Errors
- Verify `FRONTEND_URL` in backend exactly matches frontend URL (including https://)
- Check backend logs for CORS errors
- Ensure backend allows your frontend origin

### API Connection Failed
- Verify `VITE_API_URL` in Vercel matches backend URL
- Check backend is running (visit backend URL directly)
- Check browser console for exact error

### Build Failures
- Check build logs in Vercel/Render dashboard
- Ensure all dependencies are in `package.json` / `requirements.txt`
- Verify Node/Python versions match

### Slow Backend (Free Tier)
- Render free tier spins down after 15min inactivity
- First request may take 30-60s to wake up
- Consider upgrading or using Railway/Fly.io for better performance

---

## Continuous Deployment

Both Vercel and Render/Railway automatically deploy when you push to `main` branch:
- Push to GitHub → Auto-deploys → Updates live

For preview deployments (Vercel):
- Every PR gets a preview URL automatically

---

## Estimated Costs

**Free Tier (Perfect for MVP):**
- Vercel: Free (hobby plan)
- Render: Free (spins down after inactivity)
- Railway: Free (limited hours)
- Fly.io: Free (3 shared VMs)

**Paid (Better Performance):**
- Vercel Pro: $20/month
- Render: $7/month (always-on)
- Railway: $5/month (starter)
- Total: ~$32/month

---

## Quick Deploy Checklist

- [ ] Push code to GitHub
- [ ] Deploy backend (Render/Railway/Fly.io)
- [ ] Set backend environment variables
- [ ] Get backend URL
- [ ] Deploy frontend (Vercel)
- [ ] Set frontend environment variable (`VITE_API_URL`)
- [ ] Update backend `FRONTEND_URL` with Vercel URL
- [ ] Test upload functionality
- [ ] Verify CORS works
- [ ] Celebrate! 🎉
