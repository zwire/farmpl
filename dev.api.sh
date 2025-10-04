#!/bin/bash

cd /workspace/api
API_KEYS=devkey1 uv run uvicorn main:app --reload
