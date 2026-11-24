# This file is part of the GraphHopper Directions API client library.
import httpx
from backend.config import settings


class GraphHopperService:
    """Service wrapper for the GraphHopper Directions API."""

    def __init__(self, client: httpx.AsyncClient) -> None:
        self.client = client
        self.base_url = settings.graphhopper_base_url
        self.api_key = settings.graphhopper_api_key

    async def get_route(
        self,
        origin_lat: float,
        origin_lon: float,
        dest_lat: float,
        dest_lon: float,
        profile: str = "car",
    ) -> dict:
        """Fetch routing geometries and distances between two points."""
        endpoint = f"{self.base_url}/route"
        
        # GraphHopper requires points in "lat,lon" format
        params = [
            ("point", f"{origin_lat},{origin_lon}"),
            ("point", f"{dest_lat},{dest_lon}"),
            ("profile", profile),
            ("locale", "en"),
            ("calc_points", "true"),
            ("points_encoded", "true"),
            ("details", "road_environment"),
            ("details", "distance"),
            ("key", self.api_key),
        ]

        response = await self.client.get(endpoint, params=params)
        response.raise_for_status()
        
        return response.json()