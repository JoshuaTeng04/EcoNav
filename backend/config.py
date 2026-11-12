# Load environement variables from .env file
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from the .env file."""
    
    graphhopper_api_key: str = Field(..., validation_alias="GRAPHHOPPER_API_KEY")
    graphhopper_base_url: str = "https://graphhopper.com/api/1"

    climatiq_api_key: str = Field(..., validation_alias="CLIMATIQ_API_KEY")
    climatiq_base_url: str = "https://api.climatiq.io/data/v1"
    climatiq_data_version: str = "^34"
    
    http_timeout: float = 10.0

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()