import sys
from pathlib import Path
import pytest

# Ensure backend root is on sys.path for test discovery
BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))