import inspect
import json
import logging
from typing import Any

from ai.chatbot.cerebras_client import CerebrasClient
from ai.chatbot.tools import (
    TOOLS_SCHEMA,
    get_recent_alerts,
    get_sensor_data,
    retrieve_knowledge,
)

logger = logging.getLogger(__name__)


SYSTEM_PROMPT = """
Anda adalah AquaMine AI Assistant, asisten ahli untuk monitoring kualitas air di area pertambangan Indonesia.

KEMAMPUAN:
- Menjawab pertanyaan tentang kualitas air dan kimia air
- Menjelaskan data sensor dan anomali yang terdeteksi
- Memberikan rekomendasi berdasarkan kondisi air saat ini
- Menjelaskan regulasi Indonesia (PP No. 22/2021, PROPER)

ATURAN:
1. Selalu jawab dalam Bahasa Indonesia.
2. Gunakan tool `retrieve_knowledge` untuk mencari informasi umum (e.g. "Apa itu Yellow Boy?").
3. Gunakan tool `get_sensor_data` untuk mendapatkan data sensor terkini.
   - Jika user bertanya "kondisi sensor" tanpa menyebut ID, asumsikan Sensor 1 atau minta klarifikasi.
4. Gunakan tool `get_recent_alerts` untuk melihat alert terbaru.
5. Jangan berhalusinasi. Jika data tidak ada, katakan tidak ada.

PENTING - TIMEZONE:
- Semua timestamp di database disimpan dalam UTC (Coordinated Universal Time)
- Indonesia menggunakan WIB (Waktu Indonesia Barat) = UTC+7
- Ketika membaca timestamp dari database atau API:
  * Timestamp 10:00 UTC = 17:00 WIB (10 + 7 = 17)
  * Timestamp 15:00 UTC = 22:00 WIB (15 + 7 = 22)
- Saat menjelaskan waktu ke user, SELALU konversi ke WIB dan sebutkan "WIB"
- Contoh: "Data sensor terakhir pada pukul 17:58 WIB (10:58 UTC)"
""".strip()


class ChatOrchestrator:
    def __init__(self, cerebras_client: CerebrasClient | None = None) -> None:
        self.cerebras_client = cerebras_client or CerebrasClient()
        self.sessions: dict[str, list[dict[str, Any]]] = {}
        self.tool_handlers = {
            "retrieve_knowledge": retrieve_knowledge,
            "get_sensor_data": get_sensor_data,
            "get_recent_alerts": get_recent_alerts,
        }

    async def process_user_message(self, user_message: str, session_id: str) -> str:
        messages = self.sessions.setdefault(session_id, [])

        # Prepend system prompt if new session
        if not messages:
            messages.append({"role": "system", "content": SYSTEM_PROMPT})

        messages.append({"role": "user", "content": user_message})

        for _ in range(10):
            response = await self.cerebras_client.chat_completion(messages, tools=TOOLS_SCHEMA)
            message = self._extract_message(response)
            if message is None:
                return "Chat service unavailable."

            content = message.get("content")
            tool_calls = message.get("tool_calls") or []
            assistant_message: dict[str, Any] = {"role": "assistant", "content": content}
            if tool_calls:
                assistant_message["tool_calls"] = tool_calls
            messages.append(assistant_message)

            if not tool_calls:
                return content or ""

            tool_responses = await self._execute_tool_calls(tool_calls)
            messages.extend(tool_responses)

        return "I couldn't complete that request right now."

    async def _execute_tool_calls(self, tool_calls: list[Any]) -> list[dict[str, Any]]:
        responses: list[dict[str, Any]] = []
        for tool_call in tool_calls:
            tool_call_data = self._coerce_mapping(tool_call)
            tool_id = tool_call_data.get("id") or tool_call_data.get("tool_call_id")
            function_data = self._coerce_mapping(tool_call_data.get("function", {}))
            name = function_data.get("name") or tool_call_data.get("name")
            arguments = function_data.get("arguments", {})
            parsed_args = self._parse_arguments(arguments)

            result = await self._run_tool(name, parsed_args)
            responses.append(
                {
                    "role": "tool",
                    "tool_call_id": tool_id,
                    "name": name,
                    "content": json.dumps(result, ensure_ascii=True),
                }
            )
        return responses

    async def _run_tool(self, name: str | None, arguments: dict[str, Any]) -> Any:
        if not name:
            return {"error": "Tool name missing."}

        handler = self.tool_handlers.get(name)
        if handler is None:
            return {"error": f"Unknown tool: {name}"}

        try:
            result = handler(**arguments)
            if inspect.isawaitable(result):
                return await result
            return result
        except Exception as exc:
            logger.exception("Tool execution failed: %s", exc)
            return {"error": f"Tool execution failed: {name}"}

    def _extract_message(self, response: object | None) -> dict[str, Any] | None:
        if response is None:
            return None

        if isinstance(response, dict):
            choices = response.get("choices") or []
            if not choices:
                return None
            message = choices[0].get("message") or choices[0].get("delta")
            return self._coerce_mapping(message)

        choices = getattr(response, "choices", None)
        if not choices:
            return None
        first_choice = choices[0]
        message = getattr(first_choice, "message", None) or getattr(first_choice, "delta", None)
        return self._coerce_mapping(message)

    def _coerce_mapping(self, value: object) -> dict[str, Any]:
        if value is None:
            return {}
        if isinstance(value, dict):
            return value
        if hasattr(value, "model_dump"):
            return value.model_dump()
        if hasattr(value, "dict"):
            return value.dict()
        return {
            "id": getattr(value, "id", None),
            "tool_call_id": getattr(value, "tool_call_id", None),
            "name": getattr(value, "name", None),
            "function": getattr(value, "function", None),
            "content": getattr(value, "content", None),
            "tool_calls": getattr(value, "tool_calls", None),
        }

    def _parse_arguments(self, arguments: Any) -> dict[str, Any]:
        if isinstance(arguments, dict):
            return arguments
        if not arguments:
            return {}
        if isinstance(arguments, str):
            try:
                return json.loads(arguments)
            except json.JSONDecodeError:
                logger.warning("Failed to parse tool arguments: %s", arguments)
                return {}
        return {}
