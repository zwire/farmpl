from __future__ import annotations

from typing import Annotated

from fastapi import Depends, Header, HTTPException, status

from .config import api_keys, auth_mode, bearer_tokens


def _unauthorized(detail: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED, detail={"message": detail}
    )


def require_auth(
    authorization: Annotated[str | None, Header(alias="Authorization")] = None,
    api_key_hdr: Annotated[str | None, Header(alias="X-API-Key")] = None,
):
    mode = auth_mode()
    if mode == "none":
        return None

    if mode == "api_key":
        keys = api_keys()
        key_val: str | None = None
        if api_key_hdr:
            key_val = api_key_hdr
        elif authorization and authorization.startswith("ApiKey "):
            key_val = authorization.removeprefix("ApiKey ")
        if not key_val or key_val not in keys:
            raise _unauthorized("invalid or missing API key")
        return None

    if mode == "bearer":
        toks = bearer_tokens()
        if authorization and authorization.startswith("Bearer "):
            token = authorization.removeprefix("Bearer ")
            if token in toks:
                return None
        raise _unauthorized("invalid or missing bearer token")

    # Fallback
    raise _unauthorized("auth mode not supported")


# Export a FastAPI dependency wrapper for readability
AuthDependency = Depends(require_auth)
