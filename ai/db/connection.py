import os
from contextlib import contextmanager
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session


def get_database_url() -> str:
    url = os.getenv(
        "DATABASE_URL", "postgresql+psycopg://aquamine:changeme@localhost:5432/aquamine_db"
    )
    return url


def get_engine(echo: bool = False):
    return create_engine(
        get_database_url(),
        echo=echo,
        pool_pre_ping=True,
        pool_size=5,
        max_overflow=10,
    )


_engine = None
_SessionLocal = None


def get_session_factory():
    global _engine, _SessionLocal
    if _SessionLocal is None:
        _engine = get_engine()
        _SessionLocal = sessionmaker(bind=_engine, expire_on_commit=False)
    return _SessionLocal


def get_session() -> Session:
    SessionLocal = get_session_factory()
    return SessionLocal()


@contextmanager
def session_scope():
    session = get_session()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


async_session_factory = None
