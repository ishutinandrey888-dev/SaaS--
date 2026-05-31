from __future__ import annotations

import logging

import httpx

from app.core.config import get_settings

logger = logging.getLogger("telegram")


async def send_ops_message(text: str) -> bool:
    """Send an operational alert/digest to Telegram.

    Missing bot settings are not an error: local/dev deployments should
    run the same scheduled tasks without leaking secrets into the repo.
    """
    settings = get_settings()
    if not settings.telegram_bot_token or not settings.telegram_ops_chat_id:
        logger.info("telegram_ops_not_configured")
        return False

    url = f"https://api.telegram.org/bot{settings.telegram_bot_token}/sendMessage"
    payload = {
        "chat_id": settings.telegram_ops_chat_id,
        "text": text,
        "disable_web_page_preview": True,
    }
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.post(url, json=payload)
        response.raise_for_status()
    return True
