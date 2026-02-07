import asyncio
import importlib
import logging
import os
from collections.abc import Callable, Mapping, Sequence
from types import ModuleType
from typing import Protocol, cast

logger = logging.getLogger(__name__)


class _ChatCompletions(Protocol):
    def create(
        self,
        *,
        model: str,
        messages: Sequence[Mapping[str, object]],
        tools: Sequence[Mapping[str, object]] | None = None,
    ) -> object: ...


class _ChatClient(Protocol):
    completions: _ChatCompletions


class _OpenAIClient(Protocol):
    chat: _ChatClient


def _load_openai_client(api_key: str, base_url: str) -> _OpenAIClient | None:
    try:
        module: ModuleType = importlib.import_module("openai")
    except Exception as exc:
        logger.error("Failed to import OpenAI SDK: %s", exc)
        return None

    client_factory: object | None = getattr(module, "OpenAI", None)
    if not callable(client_factory):
        logger.error("OpenAI client not available in openai module.")
        return None

    factory = cast(Callable[..., _OpenAIClient], client_factory)
    return factory(api_key=api_key, base_url=base_url)


class OpenRouterClient:
    def __init__(self, api_key: str | None = None, model: str | None = None) -> None:
        self.api_key: str | None = api_key or os.getenv("OPENROUTER_API_KEY")
        self.model: str = model or os.getenv("OPENROUTER_MODEL", "openai/gpt-4o-mini")
        self.base_url: str = "https://openrouter.ai/api/v1"
        self.client: _OpenAIClient | None = None

        if not self.api_key:
            logger.warning("OPENROUTER_API_KEY not found. OpenRouter chat will fail without it.")
            return

        self.client = _load_openai_client(self.api_key, self.base_url)
        if not self.client:
            logger.warning("OpenRouter client could not be initialized.")

    async def chat_completion(
        self,
        messages: Sequence[Mapping[str, object]],
        tools: Sequence[Mapping[str, object]] | None = None,
    ) -> object | None:
        if not self.client:
            logger.error("OpenRouter client not initialized.")
            return None

        try:
            if tools is None:
                return await asyncio.to_thread(
                    self.client.chat.completions.create,
                    model=self.model,
                    messages=messages,
                )

            return await asyncio.to_thread(
                self.client.chat.completions.create,
                model=self.model,
                messages=messages,
                tools=tools,
            )
        except Exception as exc:
            logger.exception("OpenRouter chat completion failed: %s", exc)
            return {"error": str(exc)}
