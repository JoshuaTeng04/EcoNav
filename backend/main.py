from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

app = FastAPI(title="Eco Navigation API")


@app.get("/api/health")
def health():
    """Simple check that the backend is running."""
    return {"status": "ok"}


# Serve the frontend (index.html, css, js). Keep this below the API routes.
app.mount("/", StaticFiles(directory="frontend", html=True), name="frontend")