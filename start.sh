#!/usr/bin/env bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8888
