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


class _CerebrasClient(Protocol):
    chat: _ChatClient


def _load_cerebras_client(api_key: str) -> _CerebrasClient | None:
    try:
        module: ModuleType = importlib.import_module("cerebras.cloud.sdk")
    except Exception as exc:
        logger.error("Failed to import Cerebras SDK: %s", exc)
        return None

    client_factory: object | None = getattr(module, "Cerebras", None)
    if not callable(client_factory):
        logger.error("Cerebras client not available in cerebras.cloud.sdk.")
        return None

    factory = cast(Callable[..., _CerebrasClient], client_factory)
    return factory(api_key=api_key)


class CerebrasClient:
    def __init__(self, api_key: str | None = None) -> None:
        self.api_key: str | None = api_key or os.getenv("CEREBRAS_API_KEY")
        self.client: _CerebrasClient | None = None

        if not self.api_key:
            logger.warning("CEREBRAS_API_KEY not found. Cerebras chat will fail without it.")
            return

        self.client = _load_cerebras_client(self.api_key)
        if not self.client:
            logger.warning("Cerebras client could not be initialized.")

    async def chat_completion(
        self,
        messages: Sequence[Mapping[str, object]],
        tools: Sequence[Mapping[str, object]] | None = None,
    ) -> object | None:
        if not self.client:
            logger.error("Cerebras client not initialized.")
            return None

        try:
            if tools is None:
                return await asyncio.to_thread(
                    self.client.chat.completions.create,
                    model="zai-glm-4.7",
                    messages=messages,
                )

            return await asyncio.to_thread(
                self.client.chat.completions.create,
                model="zai-glm-4.7",
                messages=messages,
                tools=tools,
            )
        except Exception as exc:
            logger.exception("Cerebras chat completion failed: %s", exc)
            return None
