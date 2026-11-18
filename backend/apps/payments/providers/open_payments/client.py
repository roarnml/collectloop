
import json
import os
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import Request, urlopen


REQUEST_TIMEOUT = 20


class OpenPaymentsAdapterError(Exception):
    """Raised when an Open Payments adapter request fails."""


def _get_adapter_configuration():
    base_url = os.environ.get("OPEN_PAYMENTS_ADAPTER_URL", "").strip()
    api_key = os.environ.get("OPEN_PAYMENTS_ADAPTER_KEY", "").strip()

    if not base_url or not api_key:
        raise OpenPaymentsAdapterError(
            "Open Payments adapter configuration is missing."
        )

    try:
        parsed_url = urlsplit(base_url)
    except ValueError as exc:
        raise OpenPaymentsAdapterError(
            "Open Payments adapter URL is invalid."
        ) from exc

    if (
        parsed_url.scheme not in ("http", "https")
        or not parsed_url.netloc
        or parsed_url.username
        or parsed_url.password
        or parsed_url.query
        or parsed_url.fragment
    ):
        raise OpenPaymentsAdapterError(
            "Open Payments adapter URL must be a valid HTTP or HTTPS base URL."
        )

    return base_url.rstrip("/"), api_key


def _extract_error_message(body):
    """Extract a safe, useful error message from an adapter response."""
    try:
        result = json.loads(body.decode("utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError, AttributeError):
        return None

    if not isinstance(result, dict):
        return None

    return (
        result.get("message")
        or result.get("error")
    )


def _request(method, path, payload=None):
    base_url, api_key = _get_adapter_configuration()

    url = f"{base_url}{path}"

    headers = {
        "Accept": "application/json",
        "x-adapter-key": api_key,
    }

    body = None

    if payload is not None:
        headers["Content-Type"] = "application/json"

        try:
            body = json.dumps(payload).encode("utf-8")
        except (TypeError, ValueError) as exc:
            raise OpenPaymentsAdapterError(
                "Adapter request payload could not be serialized."
            ) from exc

    request = Request(
        url,
        data=body,
        headers=headers,
        method=method,
    )

    try:
        with urlopen(request, timeout=REQUEST_TIMEOUT) as response:
            response_body = response.read()

    except HTTPError as exc:
        error_message = _extract_error_message(exc.read())

        raise OpenPaymentsAdapterError(
            error_message or f"Adapter returned HTTP {exc.code}."
        ) from exc

    except (URLError, TimeoutError, OSError) as exc:
        raise OpenPaymentsAdapterError(
            "Could not connect to the Open Payments adapter."
        ) from exc

    try:
        result = json.loads(response_body.decode("utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError) as exc:
        raise OpenPaymentsAdapterError(
            "Adapter returned an invalid JSON response."
        ) from exc

    if not isinstance(result, dict):
        raise OpenPaymentsAdapterError(
            "Adapter returned an unexpected response format."
        )

    if result.get("success") is not True:
        raise OpenPaymentsAdapterError(
            result.get("message")
            or result.get("error")
            or "Adapter operation failed."
        )

    if "data" not in result:
        raise OpenPaymentsAdapterError(
            "Adapter response is missing its data field."
        )

    return result["data"]


def get_wallet():
    return _request(
        "GET",
        "/api/v1/wallet",
    )


def create_incoming_payment(
    amount,
    description,
    expires_in_minutes=60,
):
    return _request(
        "POST",
        "/api/v1/incoming-payments",
        {
            "amount": amount,
            "description": description,
            "expiresInMinutes": expires_in_minutes,
        },
    )


def get_incoming_payment(incoming_payment_url):
    from urllib.parse import urlencode

    query = urlencode({
        "url": incoming_payment_url,
    })

    return _request(
        "GET",
        f"/api/v1/incoming-payment?{query}",
    )
