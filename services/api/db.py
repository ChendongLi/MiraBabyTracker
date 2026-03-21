"""Database connection and helpers."""

import os

import psycopg2
import psycopg2.extras
from psycopg2.pool import ThreadedConnectionPool

_pool: ThreadedConnectionPool | None = None


def get_pool() -> ThreadedConnectionPool:
    global _pool
    if _pool is None:
        _pool = ThreadedConnectionPool(
            minconn=1,
            maxconn=10,
            dsn=os.environ["DATABASE_URL"],
        )
    return _pool


def get_conn():
    return get_pool().getconn()


def release_conn(conn) -> None:
    get_pool().putconn(conn)
