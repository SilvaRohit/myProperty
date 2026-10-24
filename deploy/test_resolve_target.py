import importlib.util
import json
from pathlib import Path
import subprocess
import unittest

spec = importlib.util.spec_from_file_location('target', Path(__file__).with_name('resolve-target.py'))
target = importlib.util.module_from_spec(spec)
spec.loader.exec_module(target)
INSTANCE = 'i-0123456789abcdef0'


class ResolveTargetTests(unittest.TestCase):
    def test_legacy_fallback(self):
        self.assertEqual(target.resolve('', INSTANCE), INSTANCE)

    def test_parameter_overrides_stale_legacy_value(self):
        def aws(*args, **kwargs):
            return subprocess.CompletedProcess([], 0, json.dumps({'Parameter': {'Value': INSTANCE}}), '')
        self.assertEqual(target.resolve(target.PARAMETER, 'stale', aws), INSTANCE)

    def test_offline_does_not_fall_back(self):
        def aws(*args, **kwargs):
            return subprocess.CompletedProcess([], 0, '{"Parameter":{"Value":"offline"}}', '')
        with self.assertRaisesRegex(ValueError, 'offline'):
            target.resolve(target.PARAMETER, INSTANCE, aws)

    def test_read_failure_does_not_fall_back(self):
        def aws(*args, **kwargs):
            return subprocess.CompletedProcess([], 1, '', 'AccessDenied')
        with self.assertRaisesRegex(ValueError, 'Cannot read'):
            target.resolve(target.PARAMETER, INSTANCE, aws)

    def test_unexpected_parameter_rejected(self):
        with self.assertRaises(ValueError):
            target.resolve('/another/parameter', INSTANCE)

    def test_invalid_instance_rejected(self):
        for value in ['"'+INSTANCE+'"', INSTANCE+'\nextra', 'i-123']:
            with self.assertRaises(ValueError):
                target.resolve('', value)


if __name__ == '__main__':
    unittest.main()
