from __future__ import annotations

import json
import logging
import uuid
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import Any

import boto3
from boto3.dynamodb.conditions import Attr
from botocore.exceptions import ClientError

from core import config
from schemas import JobInfo, OptimizationRequest, OptimizationResult

from .job_backend import JobBackend, JobSnapshot

LOGGER = logging.getLogger(__name__)

_FINAL_STATUSES = {"succeeded", "failed", "timeout", "canceled"}


def _json_dumps(data: Any) -> bytes:
    return json.dumps(data, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


def _json_loads(data: bytes | str) -> Any:
    if isinstance(data, bytes):
        return json.loads(data.decode("utf-8"))
    return json.loads(data)


def _as_decimal(value: float) -> Decimal:
    return Decimal(f"{value:.6f}")


def _parse_dt(raw: str | None) -> datetime | None:
    if not raw:
        return None
    try:
        return datetime.fromisoformat(raw)
    except ValueError:
        try:
            return datetime.fromisoformat(raw.replace("Z", "+00:00"))
        except ValueError:
            return None


class DynamoJobBackend(JobBackend):
    def __init__(
        self,
        *,
        table_name: str,
        bucket_name: str,
        queue_url: str,
        jobs_ttl_days: int,
        dynamodb_resource: Any | None = None,
        s3_client: Any | None = None,
        sqs_client: Any | None = None,
    ) -> None:
        if not table_name:
            raise RuntimeError(
                "JOBS_TABLE_NAME must be configured for Dynamo backend"
            )
        if not bucket_name:
            raise RuntimeError(
                "JOB_PAYLOAD_BUCKET must be configured for Dynamo backend"
            )
        if not queue_url:
            raise RuntimeError(
                "JOB_QUEUE_URL must be configured for Dynamo backend"
            )

        self._ddb = dynamodb_resource or boto3.resource("dynamodb")
        self._table = self._ddb.Table(table_name)
        self._s3 = s3_client or boto3.client("s3")
        self._sqs = sqs_client or boto3.client("sqs")
        self._bucket = bucket_name
        self._queue_url = queue_url
        self._ttl_days = max(1, jobs_ttl_days)

    # ------------------ JobBackend API ------------------ #

    def enqueue(self, req: OptimizationRequest) -> JobInfo:
        job_id = str(uuid.uuid4())
        submitted_at = datetime.now(UTC)
        expires_at = int((submitted_at + timedelta(days=self._ttl_days)).timestamp())

        request_key = f"requests/{job_id}.json"
        request_payload = req.model_dump(mode="json")
        self._put_payload(request_key, request_payload)

        item: dict[str, Any] = {
            "job_id": job_id,
            "status": "queued",
            "progress": _as_decimal(0.0),
            "submitted_at": submitted_at.isoformat(),
            "cancel_flag": False,
            "expires_at": expires_at,
            "request_ref": {"s3": request_key},
        }
        if req.idempotency_key:
            item["idem_key"] = req.idempotency_key

        try:
            self._table.put_item(
                Item=item,
                ConditionExpression=Attr("job_id").not_exists(),
            )
        except ClientError as exc:
            LOGGER.exception("Failed to put job %s into table", job_id)
            raise RuntimeError("failed to enqueue job") from exc

        self._sqs.send_message(
            QueueUrl=self._queue_url,
            MessageBody=json.dumps({"job_id": job_id}),
        )

        return JobInfo(
            job_id=job_id,
            status="queued",
            progress=0.0,
            result=None,
            submitted_at=submitted_at,
            completed_at=None,
        )

    def get(self, job_id: str) -> JobInfo:
        item = self._get_item(job_id)
        return self._item_to_job_info(item, include_result=True)

    def cancel(self, job_id: str) -> bool:
        try:
            item = self._get_item(job_id)
        except KeyError:
            return False

        status = item.get("status", "queued")
        if status in _FINAL_STATUSES:
            return False

        now_iso = datetime.now(UTC).isoformat()
        if status in {"queued", "pending"}:
            self._table.update_item(
                Key={"job_id": job_id},
                UpdateExpression=(
                    "SET cancel_flag = :true, #st = :canceled, "
                    "progress = :one, completed_at = :now"
                ),
                ExpressionAttributeNames={"#st": "status"},
                ExpressionAttributeValues={
                    ":true": True,
                    ":canceled": "canceled",
                    ":one": _as_decimal(1.0),
                    ":now": now_iso,
                },
            )
        else:
            self._table.update_item(
                Key={"job_id": job_id},
                UpdateExpression="SET cancel_flag = :true",
                ExpressionAttributeValues={":true": True},
            )
        return True

    def snapshot(self, job_id: str) -> JobSnapshot:
        item = self._get_item(job_id)
        req = self._load_request(item)
        result = self._load_result(item)
        job = self._item_to_job_info(item, include_result=result is not None)
        return JobSnapshot(job=job, req=req, result=result)

    def shutdown(self, wait: bool = False) -> None:  # noqa: ARG002
        return None

    # ------------------ Helpers ------------------ #

    def _get_item(self, job_id: str) -> dict[str, Any]:
        resp = self._table.get_item(Key={"job_id": job_id})
        item = resp.get("Item")
        if not item:
            raise KeyError(job_id)
        return item

    def _put_payload(self, key: str, payload: Any) -> None:
        self._s3.put_object(
            Bucket=self._bucket,
            Key=key,
            Body=_json_dumps(payload),
            ContentType="application/json",
        )

    def _fetch_payload(self, key: str) -> Any:
        obj = self._s3.get_object(Bucket=self._bucket, Key=key)
        return _json_loads(obj["Body"].read())

    def _load_request(self, item: dict[str, Any]) -> OptimizationRequest | None:
        ref = item.get("request_ref") or {}
        key = ref.get("s3")
        if not key:
            return None
        payload = self._fetch_payload(key)
        return OptimizationRequest.model_validate(payload)

    def _load_result(self, item: dict[str, Any]) -> OptimizationResult | None:
        ref = item.get("result_ref") or {}
        key = ref.get("s3")
        if not key:
            return None
        payload = self._fetch_payload(key)
        return OptimizationResult.model_validate(payload)

    def _item_to_job_info(
        self, item: dict[str, Any], *, include_result: bool
    ) -> JobInfo:
        progress_raw = item.get("progress", Decimal("0"))
        try:
            progress = float(progress_raw)
        except (TypeError, ValueError):
            progress = 0.0

        result: OptimizationResult | None = None
        if include_result:
            try:
                result = self._load_result(item)
            except Exception:
                LOGGER.exception("Failed to load result for job %s", item.get("job_id"))

        submitted_at = _parse_dt(item.get("submitted_at")) or datetime.now(UTC)
        completed_at = _parse_dt(item.get("completed_at"))

        job = JobInfo(
            job_id=item["job_id"],
            status=item.get("status", "queued"),
            progress=max(0.0, min(1.0, progress)),
            result=result,
            submitted_at=submitted_at,
            completed_at=completed_at,
        )
        return job


def create_backend_from_env() -> DynamoJobBackend:
    return DynamoJobBackend(
        table_name=config.jobs_table_name() or "",
        bucket_name=config.job_payload_bucket() or "",
        queue_url=config.job_queue_url() or "",
        jobs_ttl_days=config.jobs_ttl_days(),
    )
