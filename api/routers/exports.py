from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Response

from core.auth import require_auth
from schemas.export import ExportRequest, ExportSummary
from services import export_aggregator as agg
from services import export_renderer as rnd
from services import export_uploader as upl
from services import job_runner

router = APIRouter(
    prefix="/v1/exports", tags=["exports"], dependencies=[Depends(require_auth)]
)


@router.post("/summary")
def export_summary(req: ExportRequest):
    # 1) 入力ソース解決
    result = None
    plan = req.source.plan
    if req.source.result is not None:
        result = req.source.result
    elif req.source.job_id is not None:
        snap = job_runner.snapshot(req.source.job_id)
        if not snap.result:
            raise HTTPException(status_code=404, detail={"message": "result not found"})
        result = snap.result
        if not plan:
            plan = snap.req.plan if snap.req else None
    else:
        # Pydantic検証済みのため到達しない想定
        raise HTTPException(status_code=400, detail={"message": "invalid source"})

    # 2) 結果妥当性
    rnd.ensure_result_ok(getattr(result, "status", None))
    if not getattr(result, "timeline", None):
        raise HTTPException(status_code=422, detail={"message": "timeline is missing"})

    # 3) 集計
    summary: ExportSummary = agg.aggregate_summary(
        result=result, plan=plan, assumptions=req.assumptions
    )

    # 4) 出力
    if req.format == "json":
        return summary
    if req.format == "zip_csv":
        bytes_zip = rnd.render_zip_csv(summary, result=result)
        if req.delivery == "url":
            info = upl.upload_zip_and_presign(
                content=bytes_zip, filename="plan-summary.zip", job_id=req.source.job_id
            )
            return info
        else:
            return Response(
                content=bytes_zip,
                media_type="application/octet-stream",
                headers={
                    "Content-Disposition": 'attachment; filename="plan-summary.zip"',
                    "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
                    "Pragma": "no-cache",
                    "Expires": "0",
                },
            )
    raise HTTPException(status_code=400, detail={"message": "unknown format"})
