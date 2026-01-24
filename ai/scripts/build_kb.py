import sys
import os
import logging

# Add parent dir to path
sys.path.append(os.path.join(os.path.dirname(__file__), "../.."))

from ai.chatbot.knowledge_base import KnowledgeBase

logging.basicConfig(level=logging.INFO)


def build():
    print("Building Knowledge Base Index...")
    kb = KnowledgeBase()
    data_dir = os.path.join(os.path.dirname(__file__), "../chatbot/data")
    print(f"Loading docs from {data_dir}")

    kb.load_documents(data_dir)
    print(f"Loaded {len(kb.chunks)} chunks.")

    kb.build_index()
    print("Index built and saved.")


if __name__ == "__main__":
    build()
