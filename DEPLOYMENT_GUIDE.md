# 🚀 LifeOS Deployment Guide

Complete guide for deploying and running the LifeOS full-stack application.

---

## 📋 Prerequisites

Before you begin, ensure you have:

- **Node.js**: Version 18.x or higher
- **npm**: Version 9.x or higher (comes with Node.js)
- **Git**: For version control
- **Text Editor**: VS Code recommended
- **Terminal**: PowerShell (Windows), bash (Mac/Linux)

Check versions:
```bash
node --version   # Should be v18.x or higher
npm --version    # Should be v9.x or higher
```

---

## 🔧 Initial Setup

### 1. Install Backend Dependencies

```bash
# In project root (C:\LifeOS)
npm install
```

This installs:
- `express` - Web server framework
- `cors` - Cross-origin resource sharing
- `body-parser` - Request parsing
- `dotenv` - Environment variables
- `sql.js` - SQLite database
- TypeScript and type definitions

### 2. Build Backend

```bash
npm run build
```

This compiles TypeScript to JavaScript in the `dist/` folder.

### 3. Install Frontend Dependencies

```bash
cd frontend
npm install
```

This installs:
- `react` and `react-dom` - UI framework
- `react-router-dom` - Routing
- `axios` - HTTP client
- `lucide-react` - Icon library
- `vite` - Build tool
- TypeScript and type definitions

**Note**: Installation may take 2-3 minutes.

---

## 🏃 Running the Application

### Development Mode (Recommended)

Run both backend and frontend simultaneously in separate terminals:

**Terminal 1 - Backend API**:
```bash
# From project root (C:\LifeOS)
npm run start:api
```

Output:
```
🚀 LifeOS API Server running on http://localhost:3001
📊 Health check: http://localhost:3001/api/health
```

**Terminal 2 - Frontend UI**:
```bash
# From project root
cd frontend
npm run dev
```

Output:
```
  VITE v5.1.4  ready in 500 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

**Access the application**: Open browser to `http://localhost:5173`

---

## 🧪 Testing the Setup

### 1. Test Backend API

Open browser or use curl:

```bash
# Health check
curl http://localhost:3001/api/health

# Response:
{"status":"ok","timestamp":"2026-08-10T...","service":"LifeOS API"}
```

### 2. Test Frontend

1. Open `http://localhost:5173` in browser
2. You should see the LifeOS home screen
3. Navigate through sidebar menu to test all screens

### 3. Test Integration

1. Check browser console (F12) for any errors
2. The frontend should show "All caught up" if no interventions exist
3. The Insights screen should show 96% context accuracy

---

## 📊 Running with Test Data

To see the system in action with sample data, run the original engine demo:

```bash
# From project root
npm start
```

This runs the original `src/index.ts` which:
- Creates sample events (text messages, calendar appointments)
- Processes them through the context engine
- Generates interventions
- Stores data in SQLite (`lifeos.db`)

Then refresh the frontend to see the data populated.

---

## 🔄 Development Workflow

### Making Backend Changes

1. Edit files in `src/api/`
2. Rebuild: `npm run build`
3. Restart server: Stop (Ctrl+C) and run `npm run start:api` again

### Making Frontend Changes

1. Edit files in `frontend/src/`
2. Vite will automatically hot-reload
3. Changes appear instantly in browser

### Common Commands

```bash
# Backend
npm run build          # Compile TypeScript
npm run start:api      # Start API server
npm start              # Run original engine demo

# Frontend (from frontend/ directory)
npm run dev            # Start dev server
npm run build          # Production build
npm run preview        # Preview production build
```

---

## 🐛 Troubleshooting

### Backend Issues

**Error: Port 3001 already in use**
```bash
# Windows
netstat -ano | findstr :3001
taskkill /PID <PID> /F

# Change port in .env:
PORT=3002
```

**Error: Module not found**
```bash
# Reinstall dependencies
rm -rf node_modules
npm install
npm run build
```

**Error: Cannot find lifeos.db**
- Run `npm start` once to generate test data
- Database created at `C:\LifeOS\lifeos.db`

### Frontend Issues

**Error: Port 5173 already in use**
```bash
# Kill existing process or change port
# Edit vite.config.ts:
server: { port: 5174 }
```

**Error: Module not found**
```bash
cd frontend
rm -rf node_modules
npm install
```

**Blank screen or errors**
- Check browser console (F12) for errors
- Ensure backend is running on port 3001
- Check Network tab for failed API calls

### Integration Issues

**Frontend can't connect to backend**
- Verify backend is running: `http://localhost:3001/api/health`
- Check CORS configuration in `src/api/server.ts`
- Ensure frontend proxy is configured in `vite.config.ts`

**No data showing**
- Run backend demo to generate test data: `npm start`
- Check SQLite database: `lifeos.db` should exist
- Verify API endpoints return data

---

## 🏗️ Production Build

### Backend Production Build

```bash
# Compile TypeScript
npm run build

# Run in production mode
NODE_ENV=production npm run start:api
```

### Frontend Production Build

```bash
cd frontend

# Build optimized bundle
npm run build

# Output in frontend/dist/
# Serve with any static file server
npm run preview  # Preview locally
```

### Deploy Frontend

Static files in `frontend/dist/` can be deployed to:
- **Vercel**: `vercel deploy`
- **Netlify**: `netlify deploy --prod --dir=dist`
- **GitHub Pages**: Copy dist/ to gh-pages branch
- **AWS S3**: Upload dist/ contents to S3 bucket

### Deploy Backend

Backend can be deployed to:
- **Railway**: `railway up`
- **Heroku**: `heroku create && git push heroku main`
- **AWS EC2**: SSH and clone repo
- **Docker**: Create Dockerfile and deploy to container service

---

## 🔐 Environment Variables

### Backend (.env)

Create `.env` in project root:

```env
PORT=3001
CLIENT_URL=http://localhost:5173
NODE_ENV=development
```

### Frontend (.env)

Create `frontend/.env`:

```env
VITE_API_URL=http://localhost:3001/api
```

For production, update `CLIENT_URL` and `VITE_API_URL` to your deployed URLs.

---

## 📦 Folder Structure

```
LifeOS/
├── src/                    # Backend source
│   ├── api/                # API routes and services
│   └── *.ts                # Core engine files
├── frontend/               # Frontend source
│   ├── src/                # React components
│   └── dist/               # Production build (after build)
├── dist/                   # Compiled backend (after build)
├── node_modules/           # Backend dependencies
├── lifeos.db               # SQLite database
├── package.json            # Backend config
└── tsconfig.json           # TypeScript config
```

---

## 🎯 Quick Reference

### URLs
- **Frontend**: http://localhost:5173
- **Backend**: http://localhost:3001
- **API Health**: http://localhost:3001/api/health
- **API Docs**: See README_FULLSTACK.md

### Important Files
- **Backend Entry**: `src/api/index.ts`
- **Frontend Entry**: `frontend/src/main.tsx`
- **API Service**: `src/api/services/lifeos-service.ts`
- **API Client**: `frontend/src/services/api.ts`

### Ports
- **3001**: Backend API server
- **5173**: Frontend dev server

---

## 🔄 Update Workflow

### Pull Latest Changes

```bash
git pull origin main

# Update backend
npm install
npm run build

# Update frontend
cd frontend
npm install
cd ..
```

### Reset Database

```bash
# Delete existing database
rm lifeos.db

# Regenerate with test data
npm start
```

---

## 📚 Additional Resources

- **Full Documentation**: README_FULLSTACK.md
- **Implementation Summary**: IMPLEMENTATION_COMPLETE.md
- **API Reference**: See route files in `src/api/routes/`
- **Component Docs**: See comments in `frontend/src/pages/`

---

## 🆘 Getting Help

If you encounter issues:

1. **Check console logs**: Both backend and frontend
2. **Verify versions**: Node.js 18+, npm 9+
3. **Clean install**: Delete node_modules and reinstall
4. **Check ports**: Ensure 3001 and 5173 are available
5. **Review logs**: Look for specific error messages

---

## ✅ Deployment Checklist

Before going to production:

- [ ] Run `npm run build` (backend)
- [ ] Run `npm run build` (frontend)
- [ ] Test all API endpoints
- [ ] Test all UI screens
- [ ] Configure environment variables
- [ ] Set up error logging
- [ ] Configure CORS for production domain
- [ ] Enable HTTPS
- [ ] Set up database backups
- [ ] Configure monitoring

---

**Ready to deploy! 🚀**

For questions or issues, refer to the implementation documentation or check the inline code comments.
