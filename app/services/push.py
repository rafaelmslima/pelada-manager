"""Envio de push notifications via Expo Push API (sem dependencias externas)."""

from __future__ import annotations

import json
import urllib.error
import urllib.request


EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"


def _is_expo_token(token: str) -> bool:
    return token.startswith("ExponentPushToken") or token.startswith("ExpoPushToken")


def send_push(
    tokens: list[str],
    title: str,
    body: str,
    data: dict | None = None,
) -> None:
    """Envia uma notificacao para varios device tokens. Best-effort: nunca levanta erro."""
    messages = [
        {"to": token, "title": title, "body": body, "sound": "default", "data": data or {}}
        for token in tokens
        if token and _is_expo_token(token)
    ]
    if not messages:
        return

    payload = json.dumps(messages).encode("utf-8")
    request = urllib.request.Request(
        EXPO_PUSH_URL,
        data=payload,
        headers={"Content-Type": "application/json", "Accept": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=10) as response:
            response.read()
    except (urllib.error.URLError, TimeoutError, OSError) as error:
        # Falha de rede/servico de push nao pode quebrar o fluxo principal.
        print(f"[push] falha ao enviar: {error}")
