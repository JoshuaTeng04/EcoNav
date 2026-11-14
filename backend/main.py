import asyncio
import logging
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from typing import AsyncGenerator, Literal

import httpx
from fastapi import FastAPI, HTTPException, Request, status
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from backend.config import settings
from backend.services.carbon import ClimatiqService
from backend.services.graphhopper import GraphHopperService
from backend.services.weather import OpenWeatherService

logger = logging.getLogger("uvicorn.error")


class Coordinates(BaseModel):
    latitude: float = Field(..., ge=-90.0, le=90.0)
    longitude: float = Field(..., ge=-180.0, le=180.0)


class RoutePlanRequest(BaseModel):
    origin: Coordinates
    destination: Coordinates
    vehicle_profile: str = Field(default="car")
    # Used for the emissions estimate. Must match the planner dropdown values.
    vehicle_type: Literal["sedan", "suv"] = "sedan"


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
    """Plan a route, then add its emissions estimate and weather."""
    client = req.app.state.http_client
    gh_service = GraphHopperService(client)
    carbon_service = ClimatiqService(client)
    weather_service = OpenWeatherService(client)

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
        distance_km = round(primary_path["distance"] / 1000.0, 2)
        duration_minutes = round(primary_path["time"] / 60000.0, 2)

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

    # Reject routes that need a ferry. Bridges and tunnels are still allowed.
    segments = primary_path.get("details", {}).get("road_environment", [])
    if any(segment[2] == "ferry" for segment in segments):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="No valid route: this trip requires a ferry crossing.",
        )

    # Emissions are optional: if Climatiq fails, the route is still returned
    # and emissions_kg stays None. The reason is logged in the terminal.
    emissions_kg = None
    try:
        estimate = await carbon_service.estimate_emissions(
            distance_km=distance_km,
            vehicle_type=payload.vehicle_type,
        )
        emissions_kg = estimate["emissions_kg"]
    except httpx.HTTPStatusError as exc:
        logger.warning(
            "Climatiq error %s: %s", exc.response.status_code, exc.response.text
        )
    except Exception as exc:
        logger.warning("Climatiq estimate failed: %s", exc)

    # Weather is optional too. Origin is checked for now (departure) and the
    # destination for the estimated arrival time. Both calls run together.
    weather = None
    try:
        arrival = datetime.now(timezone.utc) + timedelta(minutes=duration_minutes)
        origin_weather, destination_weather = await asyncio.gather(
            weather_service.get_current_weather(
                payload.origin.latitude, payload.origin.longitude
            ),
            weather_service.get_forecast_weather(
                payload.destination.latitude, payload.destination.longitude, arrival
            ),
        )
        weather = {"origin": origin_weather, "destination": destination_weather}
    except httpx.HTTPStatusError as exc:
        logger.warning(
            "OpenWeather error %s: %s", exc.response.status_code, exc.response.text
        )
    except Exception as exc:
        logger.warning("OpenWeather request failed: %s", exc)

    return {
        "distance_km": distance_km,
        "duration_minutes": duration_minutes,
        "encoded_polyline": primary_path["points"],
        "emissions_kg": emissions_kg,
        "weather": weather,
    }


# Serve the frontend (index.html, css, js). Keep this below the API routes.
app.mount("/", StaticFiles(directory="frontend", html=True), name="frontend")