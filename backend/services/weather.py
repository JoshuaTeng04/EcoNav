# OpenWeather API client: current weather and forecast for a point.
import asyncio
from datetime import datetime, timezone

import httpx
from backend.config import settings

# Weather conditions that count as rain for the warning.
RAIN_CONDITIONS = {"Rain", "Drizzle", "Thunderstorm"}
# Chance of rain (0 to 1) at or above which a warning is shown.
RAIN_WARNING_THRESHOLD = 0.5


class OpenWeatherService:
    """Service wrapper for the OpenWeather Current Weather and Forecast APIs."""

    def __init__(self, client: httpx.AsyncClient) -> None:
        self.client = client
        self.base_url = settings.openweather_base_url
        self.api_key = settings.openweather_api_key

    async def _get(self, endpoint: str, lat: float, lon: float) -> dict:
        """Call an OpenWeather endpoint for a location, in metric units."""
        params = {
            "lat": lat,
            "lon": lon,
            "units": "metric",
            "appid": self.api_key,
        }
        response = await self.client.get(f"{self.base_url}/{endpoint}", params=params)
        response.raise_for_status()
        return response.json()

    async def _forecast_reading(self, lat: float, lon: float, when: datetime) -> dict:
        """Return the 3-hour forecast reading closest to the given time."""
        readings = (await self._get("forecast", lat, lon))["list"]
        target = when.timestamp()
        return min(readings, key=lambda reading: abs(reading["dt"] - target))

    @staticmethod
    def _summary(temperature: float, condition: dict, rain_chance: float) -> dict:
        """Build the weather summary sent to the frontend."""
        return {
            "temperature_c": round(temperature, 1),
            "condition": condition["description"],
            "icon": condition["icon"],
            "rain_chance_percent": round(rain_chance * 100),
            "rain_expected": (
                condition["main"] in RAIN_CONDITIONS
                or rain_chance >= RAIN_WARNING_THRESHOLD
            ),
        }

    async def get_current_weather(self, lat: float, lon: float) -> dict:
        """Weather right now, used for the starting point.

        Temperature and condition are the observed current values. Chance of
        rain comes from the next forecast reading, because the current weather
        endpoint does not include it.
        """
        current, upcoming = await asyncio.gather(
            self._get("weather", lat, lon),
            self._forecast_reading(lat, lon, datetime.now(timezone.utc)),
        )
        return self._summary(
            temperature=current["main"]["temp"],
            condition=current["weather"][0],
            rain_chance=upcoming.get("pop", 0),
        )

    async def get_forecast_weather(self, lat: float, lon: float, when: datetime) -> dict:
        """Forecast for a future time, used for the destination on arrival."""
        reading = await self._forecast_reading(lat, lon, when)
        return self._summary(
            temperature=reading["main"]["temp"],
            condition=reading["weather"][0],
            rain_chance=reading.get("pop", 0),
        )