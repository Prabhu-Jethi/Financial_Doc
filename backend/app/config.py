from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List
from dotenv import load_dotenv

load_dotenv()

class Settings(BaseSettings):
    app_name: str = "Financial Document Intelligence API"
    app_version: str = "0.1.0"
    debug: bool = False

    database_url: str = ""
    supabase_url: str = ""
    supabase_secret_key: str = ""

    ## operational timeouts
    query_deadline_seconds: int = 45
    database_timeout_seconds: int = 10
    llm_timeout_seconds: int = 30

    cors_origins: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

    model_config = SettingsConfigDict(
        env_file = ".env",
        env_file_encoding = "utf-8",
        extra = "ignore",
    )

settings = Settings()