from __future__ import annotations

import os
from datetime import UTC, datetime
from uuid import uuid4

import boto3


def upload_zip_and_presign(
    *,
    content: bytes,
    filename: str = "plan-summary.zip",
    job_id: str | None = None,
    expires_in: int = 600,
) -> dict:
    bucket = os.environ.get("JOB_PAYLOAD_BUCKET")
    if not bucket:
        raise RuntimeError("JOB_PAYLOAD_BUCKET is not configured")

    now = datetime.now(UTC)
    ymd = now.strftime("%Y/%m/%d")
    jid = (job_id or "adhoc").replace("/", "_")
    key = f"exports/{ymd}/{jid}-{uuid4().hex[:10]}.zip"

    s3 = boto3.client("s3")
    s3.put_object(
        Bucket=bucket,
        Key=key,
        Body=content,
        ContentType="application/zip",
        ContentDisposition=f'attachment; filename="{filename}"',
    )

    url = s3.generate_presigned_url(
        ClientMethod="get_object",
        Params={
            "Bucket": bucket,
            "Key": key,
            "ResponseContentType": "application/zip",
            "ResponseContentDisposition": f'attachment; filename="{filename}"',
        },
        ExpiresIn=expires_in,
    )
    return {
        "url": url,
        "expires_in": expires_in,
        "bucket": bucket,
        "key": key,
        "size": len(content),
        "filename": filename,
    }
