import json
import base64
import os
import traceback
import logging
from typing import Any, Dict

from src.handlers.email import generate_email_data, validate_email_request
from src.handlers.discover import discover_labs_data

# Configure logger for this module
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

# Enable verbose error payloads when DEBUG env is truthy
DEBUG_MODE = os.getenv("DEBUG", "0") not in {"0", "false", "False", ""}

CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
}


def _build_response(status_code: int, body: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "statusCode": status_code,
        "headers": {"Content-Type": "application/json", **CORS_HEADERS},
        "body": json.dumps(body),
    }


def lambda_handler(event, context):  # noqa: D401  (AWS entrypoint)
    """Lightweight API Gateway → business-logic adapter."""

    # Handle CORS pre-flight early
    if event.get("httpMethod") == "OPTIONS":
        return {
            "statusCode": 200,
            "headers": {**CORS_HEADERS, "Access-Control-Max-Age": "86400"},
            "body": "",
        }

    raw_body = event.get("body") or "{}"
    if event.get("isBase64Encoded"):
        try:
            raw_body = base64.b64decode(raw_body).decode()
        except Exception:
            return _build_response(400, {"error": "Malformed base64 body"})

    try:
        body_json = json.loads(raw_body)
    except json.JSONDecodeError:
        return _build_response(400, {"error": "Invalid JSON"})

    # Basic routing – determine which handler to invoke
    if "college" in body_json:
        try:
            data = discover_labs_data(body_json)
            return _build_response(200, data)
        except ValueError as ve:
            logger.warning("discoverLabs validation error: %s", ve)
            return _build_response(400, {"error": str(ve)})
        except Exception as exc:
            logger.error("discoverLabs failure: %s", exc, exc_info=True)
            body = {"error": "Internal server error", "detail": str(exc)}
            if DEBUG_MODE:
                body["trace"] = traceback.format_exc()
            return _build_response(500, body)

    if "lab_title" in body_json:
        is_valid, error_msg = validate_email_request(body_json)
        if not is_valid:
            return _build_response(400, {"error": error_msg})

        try:
            data = generate_email_data(body_json)
            return _build_response(200, data)
        except ValueError as ve:
            logger.warning("generateEmail validation error: %s", ve)
            return _build_response(400, {"error": str(ve)})
        except Exception as exc:
            logger.error("generateEmail failure: %s", exc, exc_info=True)
            body = {"error": "Internal server error", "detail": str(exc)}
            if DEBUG_MODE:
                body["trace"] = traceback.format_exc()
            return _build_response(500, body)

    # Missing required keys
    return _build_response(400, {"error": "Request body must include 'college' or 'lab_title'"}) 