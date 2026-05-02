from copy import deepcopy
from typing import Any

from django.conf import settings


def rest_framework_with_rates(**rates: str) -> dict[str, Any]:
    rest_framework_settings = deepcopy(settings.REST_FRAMEWORK)
    default_rates = rest_framework_settings.get("DEFAULT_THROTTLE_RATES", {}).copy()
    default_rates.update(rates)
    rest_framework_settings["DEFAULT_THROTTLE_RATES"] = default_rates
    return rest_framework_settings
