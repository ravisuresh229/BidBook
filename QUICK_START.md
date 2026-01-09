# Quick Deploy to Vercel - 5 Minutes

## ✅ Pre-Deployment Checklist

- [x] `.gitignore` created (protects .env files)
- [x] Backend CORS updated to use environment variables
- [x] Frontend API URL updated to use environment variables
- [ ] Push to GitHub
- [ ] Deploy backend
- [ ] Deploy frontend

---

## 🚀 Quick Start (Copy-Paste Commands)

### 1. Initialize Git & Push to GitHub

```bash
cd /Users/ravisuresh/Bridgeline/bridgeline-exercise

# Initialize git
git init
git add .
git commit -m "Initial commit - BidBook ready for deployment"

# Create a new repo on GitHub, then:
# git remote add origin https://github.com/YOUR_USERNAME/bidbook.git
# git branch -M main
# git push -u origin main
```

### 2. Deploy Backend (Render - Free)

1. Go to https://render.com
2. Sign up/login
3. Click "New +" → "Web Service"
4. Connect GitHub repo
5. Settings:
   - **Name**: `bidbook-backend`
   - **Root Directory**: `backend`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
6. Environment Variables:
   ```
   OPENAI_API_KEY=sk-proj-...your-key...
   FRONTEND_URL=https://placeholder.vercel.app
   ```
7. Click "Create Web Service"
8. **Copy your backend URL**: `https://bidbook-backend.onrender.com`

### 3. Deploy Frontend (Vercel - Free)

1. Go to https://vercel.com
2. Sign up/login (use GitHub)
3. Click "Add New..." → "Project"
4. Import your GitHub repo
5. **IMPORTANT**: Click "Edit" next to "Root Directory" → Set to: `frontend`
6. Environment Variables:
   ```
   VITE_API_URL=https://bidbook-backend.onrender.com
   ```
   (Use your actual backend URL from step 2)
7. Click "Deploy"
8. **Copy your frontend URL**: `https://bidbook-xyz.vercel.app`

### 4. Update Backend CORS

1. Go back to Render dashboard
2. Update environment variable:
   ```
   FRONTEND_URL=https://bidbook-xyz.vercel.app
   ```
   (Use your actual Vercel URL)
3. Render will auto-redeploy

### 5. Test! 🎉

Visit your Vercel URL and try uploading a PDF!

---

## 📝 Environment Variables Reference

### Backend (Render Dashboard)
```
OPENAI_API_KEY=sk-proj-...your-key...
FRONTEND_URL=https://your-vercel-app.vercel.app
```

### Frontend (Vercel Dashboard)
```
VITE_API_URL=https://your-backend.onrender.com
```

---

## 🔧 Troubleshooting

**CORS Error?**
- Verify `FRONTEND_URL` in backend exactly matches your Vercel URL
- Check for trailing slashes (don't include `/` at the end)

**API Connection Failed?**
- Verify `VITE_API_URL` in Vercel matches your Render backend URL
- Check backend is running (visit Render URL directly)

**Build Failed?**
- Check Root Directory is set to `frontend` in Vercel
- Verify `package.json` and `requirements.txt` have all dependencies

---

## 💰 Cost

**100% Free** for MVP/hobby use:
- Vercel: Free forever (hobby plan)
- Render: Free (spins down after 15min inactivity)
- First request after inactivity may take 30-60s to wake up

---

## 📚 Full Documentation

See `DEPLOYMENT.md` for detailed instructions and alternatives (Railway, Fly.io).
