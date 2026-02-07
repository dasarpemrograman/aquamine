"""
LLM-based summarization and title generation for chat compaction.
"""

import logging
from typing import List, Dict, Any

from ai.chatbot.openrouter_client import OpenRouterClient

logger = logging.getLogger(__name__)


SUMMARIZATION_PROMPT = """Anda adalah asisten yang merangkum percakapan dengan akurat.

TUGAS: Buat ringkasan singkat tapi informatif dari percakapan berikut.

ATURAN:
1. Jangan tambahkan fakta yang tidak ada dalam percakapan asli
2. Sertakan: tujuan user, keputusan penting, identifikasi masalah, pertanyaan terbuka
3. Gunakan Bahasa Indonesia
4. Panjang: 2-4 kalimat saja
5. Fokus pada hal yang paling penting untuk melanjutkan percakapan

PERCAKAPAN:
{conversation}

RINGKASAN:"""


TITLE_GENERATION_PROMPT = """Anda adalah asisten yang membuat judul singkat untuk percakapan.

TUGAS: Buat judul 2-5 kata dalam Bahasa Indonesia yang merangkum topik percakapan.

ATURAN:
1. Judul harus singkat dan jelas
2. Tidak pakai tanda kutip atau emoji
3. Gunakan huruf awal kapital untuk setiap kata (Title Case)
4. Fokus pada topik utama yang dibahas

PERCAKAPAN PERTAMA:
User: {user_message}
Assistant: {assistant_message}

JUDUL:"""


def format_conversation_for_summary(messages: List[Dict[str, Any]]) -> str:
    lines = []
    for msg in messages:
        role = msg.get("role", "")
        content = msg.get("content", "")
        if role == "user":
            lines.append(f"User: {content}")
        elif role == "assistant":
            lines.append(f"Assistant: {content}")
        elif role == "tool":
            continue
    return "\n\n".join(lines)


async def generate_conversation_summary(
    messages: List[Dict[str, Any]],
    llm_client: OpenRouterClient | None = None,
) -> str:
    client = llm_client or OpenRouterClient()
    conversation = format_conversation_for_summary(messages)
    if not conversation.strip():
        return "Percakapan tentang monitoring kualitas air AquaMine."
    prompt = SUMMARIZATION_PROMPT.format(conversation=conversation)
    try:
        response = await client.chat_completion(
            messages=[{"role": "user", "content": prompt}],
        )
        summary = _extract_content_from_response(response)
        summary = summary.replace('"', "").strip()
        return summary if summary else "Percakapan tentang monitoring kualitas air."
    except Exception as e:
        logger.error(f"Failed to generate summary: {e}")
        return "Percakapan tentang monitoring kualitas air AquaMine."


async def generate_thread_title(
    first_user_message: str,
    first_assistant_message: str,
    llm_client: OpenRouterClient | None = None,
) -> str:
    client = llm_client or OpenRouterClient()
    prompt = TITLE_GENERATION_PROMPT.format(
        user_message=first_user_message[:200],
        assistant_message=first_assistant_message[:200],
    )
    try:
        response = await client.chat_completion(
            messages=[{"role": "user", "content": prompt}],
        )
        title = _extract_content_from_response(response)
        title = title.replace('"', "").replace("'", "").strip()
        words = title.split()
        if len(words) > 5:
            title = " ".join(words[:5])
        return title if title else fallback_title(first_user_message)
    except Exception as e:
        logger.error(f"Failed to generate title: {e}")
        return fallback_title(first_user_message)


def _extract_content_from_response(response: Any) -> str:
    if response is None:
        return ""
    if isinstance(response, dict):
        choices = response.get("choices")
        if choices and len(choices) > 0:
            message = choices[0].get("message", {}) if isinstance(choices[0], dict) else {}
            return str(message.get("content", "")).strip()
        return str(response.get("error", "")).strip()
    try:
        choices_attr = getattr(response, "choices", None)
        if choices_attr and len(choices_attr) > 0:
            first_choice = choices_attr[0]
            msg = getattr(first_choice, "message", None)
            if msg:
                content = getattr(msg, "content", None)
                return str(content or "").strip()
    except (AttributeError, IndexError, TypeError):
        pass
    return str(response).strip()


def fallback_title(user_message: str) -> str:
    title = user_message[:30].strip()
    if len(user_message) > 30:
        title += "..."
    return title if title else "New chat"
