"""API tests. External services are replaced with fakes, so no real API is called."""
import os

# Fake keys so the app can start without a .env file (for example in CI).
os.environ.setdefault("GRAPHHOPPER_API_KEY", "test-key")
os.environ.setdefault("CLIMATIQ_API_KEY", "test-key")
os.environ.setdefault("OPENWEATHER_API_KEY", "test-key")

import pytest
from fastapi.testclient import TestClient

from backend import main
from backend.main import app

VALID_PAYLOAD = {
    "origin": {"latitude": 14.6096, "longitude": 120.9894},
    "destination": {"latitude": 14.5649, "longitude": 120.9930},
    "vehicle_type": "sedan",
}

FAKE_WEATHER = {
    "temperature_c": 30.0,
    "condition": "clear sky",
    "icon": "01d",
    "rain_chance_percent": 0,
    "rain_expected": False,
}


def fake_route(road_environment):
    """Build a fake GraphHopper reply: 5 km, 10 minutes, one segment type."""

    async def get_route(self, **kwargs):
        return {
            "paths": [
                {
                    "distance": 5000,
                    "time": 600000,
                    "points": "abc",
                    "details": {"road_environment": [[0, 10, road_environment]]},
                }
            ]
        }

    return get_route


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client


def test_health(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_rejects_unknown_vehicle_type(client):
    payload = {**VALID_PAYLOAD, "vehicle_type": "truck"}
    response = client.post("/api/routes/plan", json=payload)
    assert response.status_code == 422


def test_rejects_invalid_latitude(client):
    payload = {**VALID_PAYLOAD, "origin": {"latitude": 200, "longitude": 120.98}}
    response = client.post("/api/routes/plan", json=payload)
    assert response.status_code == 422


def test_flags_ferry_routes(client, monkeypatch):
    """A route with a ferry is still returned, but flagged so the planner can warn the user."""

    async def fake_emissions(self, distance_km, vehicle_type):
        return {"emissions_kg": 0.77}

    async def fake_current(self, lat, lon):
        return FAKE_WEATHER

    async def fake_forecast(self, lat, lon, when):
        return FAKE_WEATHER

    monkeypatch.setattr(main.GraphHopperService, "get_route", fake_route("ferry"))
    monkeypatch.setattr(main.ClimatiqService, "estimate_emissions", fake_emissions)
    monkeypatch.setattr(main.OpenWeatherService, "get_current_weather", fake_current)
    monkeypatch.setattr(main.OpenWeatherService, "get_forecast_weather", fake_forecast)

    response = client.post("/api/routes/plan", json=VALID_PAYLOAD)

    assert response.status_code == 200
    assert response.json()["requires_ferry"] is True


def test_returns_route_with_emissions_and_weather(client, monkeypatch):
    async def fake_emissions(self, distance_km, vehicle_type):
        return {"emissions_kg": 0.77}

    async def fake_current(self, lat, lon):
        return FAKE_WEATHER

    async def fake_forecast(self, lat, lon, when):
        return FAKE_WEATHER

    monkeypatch.setattr(main.GraphHopperService, "get_route", fake_route("road"))
    monkeypatch.setattr(main.ClimatiqService, "estimate_emissions", fake_emissions)
    monkeypatch.setattr(main.OpenWeatherService, "get_current_weather", fake_current)
    monkeypatch.setattr(main.OpenWeatherService, "get_forecast_weather", fake_forecast)

    response = client.post("/api/routes/plan", json=VALID_PAYLOAD)
    data = response.json()

    assert response.status_code == 200
    assert data["distance_km"] == 5.0
    assert data["duration_minutes"] == 10.0
    assert data["emissions_kg"] == 0.77
    assert data["weather"]["origin"] == FAKE_WEATHER
    assert data["weather"]["destination"] == FAKE_WEATHER