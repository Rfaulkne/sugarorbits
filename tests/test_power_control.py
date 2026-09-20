from __future__ import annotations

import sys
import unittest
from pathlib import Path


PROJECT_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_DIR))

from app import POWEROFF_COMMAND, is_loopback_address  # noqa: E402


class PowerControlTests(unittest.TestCase):
    def test_loopback_addresses_are_accepted(self) -> None:
        self.assertTrue(is_loopback_address("127.0.0.1"))
        self.assertTrue(is_loopback_address("::1"))
        self.assertTrue(is_loopback_address("::ffff:127.0.0.1"))

    def test_lan_and_invalid_addresses_are_rejected(self) -> None:
        self.assertFalse(is_loopback_address("192.168.0.81"))
        self.assertFalse(is_loopback_address("not-an-address"))

    def test_poweroff_command_is_fixed_and_noninteractive(self) -> None:
        self.assertEqual(
            POWEROFF_COMMAND,
            ("/usr/bin/sudo", "-n", "/usr/bin/systemctl", "poweroff"),
        )


if __name__ == "__main__":
    unittest.main()
