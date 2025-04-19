# Deploying to Render

This guide provides step-by-step instructions for deploying the Supervity application to Render.

## Prerequisites

1. A [Render account](https://render.com)
2. Your code pushed to a GitHub repository
3. Google AI API key

## 1. Deploy the Backend Service

### Create a Web Service

1. Log in to your Render dashboard
2. Click "New" > "Web Service"
3. Connect your GitHub repository
4. Configure the service:
   - **Name**: `supervity-backend` (or your preferred name)
   - **Environment**: Python
   - **Region**: Choose the closest to your users
   - **Branch**: main (or your preferred branch)
   - **Build Command**: `pip install -r requirements.txt && pip install -e .`
   - **Start Command**: `uvicorn app.api.main:app --host 0.0.0.0 --port $PORT`
   - **Instance Type**: Start with free tier for testing, upgrade as needed

### Configure Environment Variables

Add the following environment variables:
- `LLM_MODEL`: `gemini-2.5-pro-preview-03-25` (or your preferred model)
- `LLM_TEMPERATURE`: `0.63` (or your preferred temperature)
- `GEMINI_API_KEY`: Your Google AI API key
- `PORT`: `10000` (Render will automatically set this)

### Configure Health Check
- **Path**: `/`
- **Status**: 200

5. Click "Create Web Service"

## 2. Deploy the Frontend

### Create a Static Site

1. In your Render dashboard, click "New" > "Static Site"
2. Connect your GitHub repository
3. Configure the site:
   - **Name**: `supervity-frontend` (or your preferred name)
   - **Branch**: main (or your preferred branch)
   - **Root Directory**: `account-research-ui` (important!)
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `dist`

### Configure Environment Variables
- `VITE_BACKEND_URL`: URL of your backend service (e.g., `https://supervity-backend.onrender.com`)

4. Click "Create Static Site"

## 3. Update CORS Settings (if needed)

If you experience CORS issues, update your backend CORS settings in `app/api/main.py`:

```python
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://your-frontend-name.onrender.com",
    "https://your-frontend-custom-domain.com",  # If you have one
]
```

Then redeploy your backend.

## 4. Final Setup

1. Once both services are deployed, open your frontend URL
2. Test the application by generating a report
3. Monitor the logs in your Render dashboard to identify any issues

## Troubleshooting

### CORS Issues
- Verify that your backend CORS settings include your frontend domain
- Ensure your frontend is using the correct backend URL

### PDF Generation Issues
- Check if WeasyPrint dependencies are properly installed on Render
- Render may require additional configuration for PDF generation

### API Timeouts
- For long-running tasks, consider implementing a proper background task queue with Redis or similar

## Scaling

As your application grows:
1. Upgrade to a paid plan for better performance
2. Consider adding a database for persistent storage
3. Implement a proper task queue for PDF generation
4. Set up a CDN for PDF storage and delivery 