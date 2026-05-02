from __future__ import annotations

import json

from config import load_config
from services.fake_changes import apply_fake_changes


def main() -> None:
    config = load_config()
    result = apply_fake_changes(config)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
