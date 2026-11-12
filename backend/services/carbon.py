# Climatiq API client: estimates the CO2e emissions of a car trip.
import httpx
from backend.config import settings

# Maps the vehicle type from the planner dropdown to a Climatiq activity ID.
# Both use the UK government (BEIS) factors with an average fuel mix.
VEHICLE_ACTIVITY_IDS = {
    "sedan": "passenger_vehicle-vehicle_type_lower_medium_car-fuel_source_na-engine_size_na-vehicle_age_na-vehicle_weight_na",
    "suv": "passenger_vehicle-vehicle_type_dual_purpose_4x4_car-fuel_source_na-engine_size_na-vehicle_age_na-vehicle_weight_na",
}


class ClimatiqService:
    """Service wrapper for the Climatiq Estimate API."""

    def __init__(self, client: httpx.AsyncClient) -> None:
        self.client = client
        self.base_url = settings.climatiq_base_url
        self.api_key = settings.climatiq_api_key

    async def estimate_emissions(
        self,
        distance_km: float,
        vehicle_type: str = "sedan",
    ) -> dict:
        """Estimate trip emissions from the route distance and vehicle type."""
        activity_id = VEHICLE_ACTIVITY_IDS.get(vehicle_type)
        if activity_id is None:
            raise ValueError(f"Unsupported vehicle type: {vehicle_type}")

        payload = {
            "emission_factor": {
                "activity_id": activity_id,
                "source": "BEIS",
                "region": "GB",
                "source_lca_activity": "fuel_combustion",
                "data_version": settings.climatiq_data_version,
            },
            "parameters": {
                "distance": distance_km,
                "distance_unit": "km",
            },
        }

        response = await self.client.post(
            f"{self.base_url}/estimate",
            json=payload,
            headers={"Authorization": f"Bearer {self.api_key}"},
        )
        response.raise_for_status()
        data = response.json()

        return {
            "emissions_kg": round(data["co2e"], 2),
            "factor_name": data["emission_factor"]["name"],
            "factor_year": data["emission_factor"]["year"],
        }