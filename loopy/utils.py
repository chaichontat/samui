from typing import Literal

from pydantic import BaseModel


class ReadonlyModel(BaseModel):
    class Config:
        allow_mutation = False


class Url(ReadonlyModel):
    url: str
    type: Literal["local", "network"] = "local"

    def __init__(self, url: str, type: Literal["local", "network"] = "local"):
        super().__init__(url=url, type=type)  # type: ignore
