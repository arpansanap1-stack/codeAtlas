import pytest
from unittest.mock import patch, MagicMock

from app.config import get_settings
from app.main import get_gemini_settings, health_check
from app.services.chat_service import get_chat_service


def test_health_check_gemini_status_unconfigured():
    settings = get_settings()
    settings.GEMINI_API_KEY = ""
    res = health_check()
    assert res.status == "ok"
    assert res.gemini_configured is False


def test_get_gemini_settings_unconfigured():
    settings = get_settings()
    settings.GEMINI_API_KEY = ""
    res = get_gemini_settings()
    assert res.configured is False
    assert res.masked_key is None
    assert "gemini" in res.chat_model
    assert "embedding" in res.embedding_model


def test_get_gemini_settings_configured():
    settings = get_settings()
    settings.GEMINI_API_KEY = "AQ.TestKey1234567890abcdef"
    chat_service = get_chat_service()
    with patch.object(chat_service, "is_configured", return_value=True):
        res = get_gemini_settings()
        assert res.configured is True
        assert res.masked_key.startswith("AQ.Tes")
        assert res.masked_key.endswith("cdef")
