from typing import List

from .base import BaseSchema


class FaqItem(BaseSchema):
    title: str
    body: str


class FaqResponse(BaseSchema):
    items: List[FaqItem]
