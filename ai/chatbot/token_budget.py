import math
import os
import logging
from typing import List, Dict, Any, Tuple

logger = logging.getLogger(__name__)

# Configuration
CONTEXT_WINDOW_TOKENS = int(os.getenv("AI_CHAT_CONTEXT_WINDOW_TOKENS", "32768"))
COMPACTION_THRESHOLD = float(os.getenv("AI_CHAT_COMPACTION_THRESHOLD", "0.85"))
RESERVED_OUTPUT_TOKENS = int(os.getenv("AI_CHAT_RESERVED_OUTPUT_TOKENS", "2048"))

# Default to a safe lower bound for output tokens
DEFAULT_RESERVED_OUTPUT = min(2048, math.ceil(0.15 * CONTEXT_WINDOW_TOKENS))
if RESERVED_OUTPUT_TOKENS <= 0:
    RESERVED_OUTPUT_TOKENS = DEFAULT_RESERVED_OUTPUT

# Estimated overhead for system prompt + tool definitions
SYSTEM_PROMPT_OVERHEAD = 1000


def estimate_tokens(text: str | None) -> int:
    """
    Estimate the number of tokens in a string using a lightweight heuristic.
    Fallbacks to character count / 3.5 if tiktoken is not available.
    """
    if not text:
        return 0

    # Heuristic: ~3.5 chars per token for mixed code/text (safe overestimate)
    # For Indonesian/English mix, 3.5 is reasonable.
    return math.ceil(len(text) / 3.5)


def estimate_message_tokens(message: Dict[str, Any]) -> int:
    """
    Estimate tokens for a single message including overhead.
    """
    content = message.get("content") or ""

    # Base tokens for content
    tokens = estimate_tokens(str(content))

    # Overhead per message (format dependent, but ~4 tokens is standard)
    tokens += 4

    # Handle tool calls/responses if present
    tool_calls = message.get("tool_calls")
    if tool_calls:
        for tc in tool_calls:
            # Estimate tokens for function name and arguments
            func = tc.get("function", {})
            tokens += estimate_tokens(func.get("name", ""))
            tokens += estimate_tokens(str(func.get("arguments", "")))
            tokens += 10  # Extra overhead for tool structure

    return tokens


def calculate_context_stats(
    messages: List[Dict[str, Any]], pending_user_message: str = ""
) -> Dict[str, Any]:
    """
    Calculate token usage statistics for the current context.
    """
    total_tokens = 0
    has_system_message = False

    for msg in messages:
        if msg.get("role") == "system":
            has_system_message = True
        if "token_estimate" in msg:
            total_tokens += int(msg["token_estimate"])
        else:
            total_tokens += estimate_message_tokens(msg)

    if pending_user_message:
        total_tokens += estimate_message_tokens({"role": "user", "content": pending_user_message})

    if not has_system_message:
        total_tokens += SYSTEM_PROMPT_OVERHEAD

    usage_ratio = total_tokens / CONTEXT_WINDOW_TOKENS
    remaining_tokens = CONTEXT_WINDOW_TOKENS - total_tokens

    return {
        "total_estimated_tokens": total_tokens,
        "context_window": CONTEXT_WINDOW_TOKENS,
        "usage_ratio": usage_ratio,
        "remaining_tokens": remaining_tokens,
        "compaction_threshold": COMPACTION_THRESHOLD,
        "reserved_output": RESERVED_OUTPUT_TOKENS,
    }


def should_compact(
    messages: List[Dict[str, Any]], pending_user_message: str = ""
) -> Tuple[bool, Dict[str, Any]]:
    """
    Determine if compaction is recommended based on token usage.
    """
    stats = calculate_context_stats(messages, pending_user_message)
    total_input = stats["total_estimated_tokens"]

    # Requirement: "input_tokens + reserved_output >= 0.85 * max_window"
    threshold_value = CONTEXT_WINDOW_TOKENS * COMPACTION_THRESHOLD

    needs_compaction = (total_input + RESERVED_OUTPUT_TOKENS) >= threshold_value

    return needs_compaction, stats
