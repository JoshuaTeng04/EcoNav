from contextlib import asynccontextmanager
from typing import AsyncGenerator
import httpx
from fastapi import FastAPI, HTTPException, status, Request 
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from backend.config import settings
from backend.services.graphhopper import GraphHopperService


class Coordinates(BaseModel):
    latitude: float = Field(..., ge=-90.0, le=90.0)
    longitude: float = Field(..., ge=-180.0, le=180.0)


class RoutePlanRequest(BaseModel):
    origin: Coordinates
    destination: Coordinates
    vehicle_profile: str = Field(default="car")

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Manage application startup and shutdown lifecycle events."""
    app.state.http_client = httpx.AsyncClient(timeout=settings.http_timeout)
    yield
    await app.state.http_client.aclose()


app = FastAPI(title="Eco Navigation API", lifespan=lifespan)


@app.get("/api/health")
def health():
    """Simple check that the backend is running."""
    return {"status": "ok"}


@app.post("/api/routes/plan")
async def plan_route(payload: RoutePlanRequest, req: Request):
    """Test endpoint for GraphHopper integration."""
    gh_service = GraphHopperService(req.app.state.http_client)
    
    try:
        route_data = await gh_service.get_route(
            origin_lat=payload.origin.latitude,
            origin_lon=payload.origin.longitude,
            dest_lat=payload.destination.latitude,
            dest_lon=payload.destination.longitude,
            profile=payload.vehicle_profile,
        )
        
        # Extract the primary route from the response
        primary_path = route_data["paths"][0]
        
        return {
            "distance_km": round(primary_path["distance"] / 1000.0, 2),
            "duration_minutes": round(primary_path["time"] / 60000.0, 2),
            "encoded_polyline": primary_path["points"]
        }
        
    except httpx.HTTPStatusError as exc:
        raise HTTPException(
            status_code=exc.response.status_code,
            detail=f"GraphHopper API error: {exc.response.text}",
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        )


# Serve the frontend (index.html, css, js). Keep this below the API routes.
app.mount("/", StaticFiles(directory="frontend", html=True), name="frontend")