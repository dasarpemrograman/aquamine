from datetime import datetime
from typing import Optional, List

from pydantic import Field

from .base import BaseSchema


class ThreadCreate(BaseSchema):
    title: Optional[str] = Field(
        None, description="Thread title (optional, defaults to 'New chat')"
    )


class ThreadUpdate(BaseSchema):
    title: str = Field(..., min_length=1, max_length=200, description="New thread title")


class ThreadResponse(BaseSchema):
    id: str
    user_id: str
    title: str
    title_source: str = Field(..., description="'auto' or 'user'")
    created_at: datetime
    updated_at: datetime
    active_segment_id: Optional[str] = None


class ThreadListResponse(BaseSchema):
    threads: List[ThreadResponse]
    total: int


class MessageCreate(BaseSchema):
    content: str = Field(..., min_length=1, description="Message content")


class MessageResponse(BaseSchema):
    id: int
    thread_id: str
    segment_id: str
    role: str = Field(..., description="system | user | assistant | tool")
    content: str
    created_at: datetime
    token_estimate: int
    metadata: Optional[dict] = None


class MessageListResponse(BaseSchema):
    messages: List[MessageResponse]
    next_cursor: Optional[str] = None
    has_more: bool = False


class SendMessageRequest(BaseSchema):
    content: str = Field(..., min_length=1, description="Message content")


class SendMessageResponse(BaseSchema):
    message: Optional[MessageResponse] = None
    response: Optional[str] = None
    compaction_required: bool = False
    token_usage: Optional[dict] = None


class CompactionPreviewRequest(BaseSchema):
    pending_message: Optional[str] = Field(
        None, description="Optional pending message to include in summary"
    )
    keep_last_n: int = Field(3, ge=0, le=10, description="Number of recent turns to keep raw")


class CompactionPreviewResponse(BaseSchema):
    summary_draft: str
    token_stats: dict
    can_compact: bool


class CompactionCommitRequest(BaseSchema):
    summary: str = Field(..., min_length=1, description="User-edited summary text")


class CompactionCommitResponse(BaseSchema):
    success: bool
    new_segment_id: Optional[str] = None
    message: str


class SegmentResponse(BaseSchema):
    id: str
    thread_id: str
    index: int
    created_at: datetime
    compaction_summary: Optional[str] = None


class ChatErrorResponse(BaseSchema):
    error: str
    detail: Optional[str] = None
