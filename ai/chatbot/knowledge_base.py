import importlib
import json
import logging
from pathlib import Path
from typing import Any

import numpy as np

faiss: Any = importlib.import_module("faiss")
SentenceTransformer: Any = getattr(
    importlib.import_module("sentence_transformers"),
    "SentenceTransformer",
)

logger = logging.getLogger(__name__)


class KnowledgeBase:
    index_dir: Path
    index_file: Path
    chunks_file: Path
    model_name: str
    chunk_size: int
    chunk_overlap: int
    _model: Any
    index: Any
    chunks: list[str]

    def __init__(
        self,
        index_dir: str | Path | None = None,
        model_name: str = "sentence-transformers/all-MiniLM-L6-v2",
        chunk_size: int = 1000,
        chunk_overlap: int = 100,
    ) -> None:
        if index_dir is None:
            index_dir = Path(__file__).resolve().parent / "data" / "faiss_index"
        self.index_dir = Path(index_dir)
        self.index_file = self.index_dir / "index.faiss"
        self.chunks_file = self.index_dir / "chunks.json"
        self.model_name = model_name
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self._model: Any = None
        self.index: Any = None
        self.chunks: list[str] = []
        _ = self.load_index()

    def load_documents(self, dir_path: str | Path) -> None:
        path = Path(dir_path)
        if not path.exists():
            logger.warning("Document path does not exist: %s", path)
            self.chunks = []
            return

        chunks: list[str] = []
        for file_path in sorted(path.rglob("*.md")):
            try:
                text = file_path.read_text(encoding="utf-8")
            except OSError as exc:
                logger.warning("Failed to read %s: %s", file_path, exc)
                continue
            chunks.extend(self._split_text(text))

        self.chunks = [chunk for chunk in chunks if chunk.strip()]

    def build_index(self) -> None:
        if not self.chunks:
            logger.warning("No document chunks loaded to index.")
            return

        embeddings = self._get_model().encode(
            self.chunks,
            convert_to_numpy=True,
            show_progress_bar=False,
            normalize_embeddings=True,
        )
        embeddings = np.asarray(embeddings, dtype="float32")
        index = faiss.IndexFlatIP(embeddings.shape[1])
        index.add(embeddings)
        self.index = index
        self._save_index()

    def search(self, query: str, k: int = 3) -> list[str]:
        if not self.index or not self.chunks:
            _ = self.load_index()
        if not self.index or not self.chunks:
            return []

        query_vector = self._get_model().encode(
            [query],
            convert_to_numpy=True,
            show_progress_bar=False,
            normalize_embeddings=True,
        )
        query_vector = np.asarray(query_vector, dtype="float32")
        _, indices = self.index.search(query_vector, k)
        results: list[str] = []
        for idx in indices[0]:
            if idx == -1 or idx >= len(self.chunks):
                continue
            results.append(self.chunks[idx])
        return results

    def load_index(self) -> bool:
        if not self.index_file.exists() or not self.chunks_file.exists():
            return False
        try:
            self.index = faiss.read_index(str(self.index_file))
            self.chunks = json.loads(self.chunks_file.read_text(encoding="utf-8"))
        except Exception as exc:
            logger.warning("Failed to load FAISS index: %s", exc)
            self.index = None
            self.chunks = []
            return False
        return True

    def _save_index(self) -> None:
        if not self.index:
            return
        self.index_dir.mkdir(parents=True, exist_ok=True)
        faiss.write_index(self.index, str(self.index_file))
        _ = self.chunks_file.write_text(
            json.dumps(self.chunks, ensure_ascii=True, indent=2),
            encoding="utf-8",
        )

    def _get_model(self) -> Any:
        if self._model is None:
            self._model = SentenceTransformer(self.model_name)
        return self._model

    def _split_text(self, text: str) -> list[str]:
        sections: list[str] = []
        current_lines: list[str] = []
        for line in text.splitlines():
            if line.lstrip().startswith("#") and current_lines:
                sections.append("\n".join(current_lines).strip())
                current_lines = [line]
            else:
                current_lines.append(line)

        if current_lines:
            sections.append("\n".join(current_lines).strip())

        chunks: list[str] = []
        for section in sections:
            if len(section) <= self.chunk_size:
                if section:
                    chunks.append(section)
                continue
            chunks.extend(self._chunk_text(section))
        return chunks

    def _chunk_text(self, text: str) -> list[str]:
        if not text:
            return []
        step = max(1, self.chunk_size - self.chunk_overlap)
        chunked: list[str] = []
        for start in range(0, len(text), step):
            piece = text[start : start + self.chunk_size].strip()
            if piece:
                chunked.append(piece)
        return chunked
