from __future__ import annotations

import json
import logging
from datetime import UTC, datetime
from decimal import Decimal
from typing import Any

import boto3
from boto3.dynamodb.conditions import Attr
from botocore.exceptions import ClientError

from core import config
from schemas import OptimizationRequest, OptimizationResult
from services.job_backend import JobCanceled
from services.optimizer_adapter import solve_sync

LOGGER = logging.getLogger(__name__)
LOGGER.setLevel(logging.INFO)


def _require(name: str, value: str | None) -> str:
    if value:
        return value
    raise RuntimeError(f"{name} must be configured for worker handler")


TABLE_NAME = _require("JOBS_TABLE_NAME", config.jobs_table_name())
PAYLOAD_BUCKET = _require("JOB_PAYLOAD_BUCKET", config.job_payload_bucket())

_dynamo = boto3.resource("dynamodb")
_table = _dynamo.Table(TABLE_NAME)
_s3 = boto3.client("s3")

_FINAL_STATUSES = {"succeeded", "failed", "timeout", "canceled"}


def _decimal(value: float) -> Decimal:
    return Decimal(f"{max(0.0, min(1.0, value)):.6f}")


def _now_iso() -> str:
    return datetime.now(UTC).isoformat()


def _load_job(job_id: str) -> dict[str, Any] | None:
    resp = _table.get_item(Key={"job_id": job_id})
    return resp.get("Item")


def _load_request(item: dict[str, Any]) -> OptimizationRequest | None:
    ref = item.get("request_ref") or {}
    key = ref.get("s3")
    if not key:
        return None
    obj = _s3.get_object(Bucket=PAYLOAD_BUCKET, Key=key)
    payload = json.loads(obj["Body"].read())
    return OptimizationRequest.model_validate(payload)


def _store_result(job_id: str, result: OptimizationResult) -> None:
    key = f"results/{job_id}.json"
    body = json.dumps(
        result.model_dump(mode="json"),
        separators=(",", ":"),
    ).encode("utf-8")
    _s3.put_object(
        Bucket=PAYLOAD_BUCKET,
        Key=key,
        Body=body,
        ContentType="application/json",
    )
    _table.update_item(
        Key={"job_id": job_id},
        UpdateExpression=(
            "SET #s = :done, progress = :one, completed_at = :now, "
            "result_ref = :ref REMOVE error_message"
        ),
        ExpressionAttributeNames={"#s": "status"},
        ExpressionAttributeValues={
            ":done": "succeeded",
            ":one": _decimal(1.0),
            ":now": _now_iso(),
            ":ref": {"s3": key},
        },
    )


def _mark_canceled(job_id: str) -> None:
    _table.update_item(
        Key={"job_id": job_id},
        UpdateExpression=(
            "SET #s = :canceled, progress = :one, completed_at = :now, "
            "cancel_flag = :true REMOVE error_message, result_ref"
        ),
        ExpressionAttributeNames={"#s": "status"},
        ExpressionAttributeValues={
            ":canceled": "canceled",
            ":one": _decimal(1.0),
            ":now": _now_iso(),
            ":true": True,
        },
    )


def _mark_failed(job_id: str, reason: str | None) -> None:
    _table.update_item(
        Key={"job_id": job_id},
        UpdateExpression=(
            "SET #s = :failed, progress = :one, completed_at = :now, "
            "error_message = :reason REMOVE result_ref"
        ),
        ExpressionAttributeNames={"#s": "status"},
        ExpressionAttributeValues={
            ":failed": "failed",
            ":one": _decimal(1.0),
            ":now": _now_iso(),
            ":reason": reason or "worker execution failed",
        },
    )


def _set_running(job_id: str) -> None:
    _table.update_item(
        Key={"job_id": job_id},
        UpdateExpression=(
            "SET #s = :running, progress = if_not_exists(progress, :zero), "
            "started_at = if_not_exists(started_at, :now), last_heartbeat = :now"
        ),
        ExpressionAttributeNames={"#s": "status"},
        ExpressionAttributeValues={
            ":running": "running",
            ":zero": _decimal(0.0),
            ":now": _now_iso(),
        },
    )


def _update_progress(job_id: str, pct: float) -> None:
    try:
        _table.update_item(
            Key={"job_id": job_id},
            UpdateExpression="SET progress = :pct, last_heartbeat = :now",
            ConditionExpression=(
                Attr("cancel_flag").eq(False) | Attr("cancel_flag").not_exists()
            ),
            ExpressionAttributeValues={
                ":pct": _decimal(pct),
                ":now": _now_iso(),
            },
        )
    except ClientError as exc:
        if exc.response.get("Error", {}).get("Code") == (
            "ConditionalCheckFailedException"
        ):
            raise JobCanceled from exc
        raise


def _process_job(job_id: str) -> None:
    item = _load_job(job_id)
    if not item:
        LOGGER.info("Job %s not found, skipping", job_id)
        return

    status = item.get("status", "queued")
    if status in _FINAL_STATUSES:
        LOGGER.info("Job %s already finalized with status %s", job_id, status)
        return

    if item.get("cancel_flag") is True and status in {"queued", "pending"}:
        _mark_canceled(job_id)
        return

    request = _load_request(item)
    if request is None:
        LOGGER.error("Job %s missing request payload", job_id)
        _mark_failed(job_id, "request payload missing")
        return

    _set_running(job_id)

    def _progress_cb(pct: float, phase: str) -> None:  # noqa: ARG001
        _update_progress(job_id, pct)

    try:
        result = solve_sync(request, progress_cb=_progress_cb)
    except JobCanceled:
        LOGGER.info("Job %s canceled during execution", job_id)
        _mark_canceled(job_id)
        return
    except Exception as exc:  # pragma: no cover - defensive
        LOGGER.exception("Job %s failed: %s", job_id, exc)
        _mark_failed(job_id, str(exc))
        return

    _store_result(job_id, result)


def handler(event: dict[str, Any], _context: Any) -> dict[str, Any]:
    records = event.get("Records", [])
    for record in records:
        try:
            body = record.get("body")
            if not body:
                continue
            payload = json.loads(body)
            job_id = payload.get("job_id")
            if not job_id:
                LOGGER.warning("Record without job_id: %s", body)
                continue
            _process_job(job_id)
        except Exception as exc:  # pragma: no cover - defensive
            LOGGER.exception("Failed to process record: %s", exc)
    return {"status": "ok", "processed": len(records)}
