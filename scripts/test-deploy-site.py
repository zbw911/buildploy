#!/usr/bin/env python3
"""Exercise deployment isolation, manifest rejection and atomic version changes."""
import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import stat
import sys
import tarfile
import tempfile
import unittest

sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location('deploy_site', Path(__file__).with_name('deploy-site.py'))
deployment = importlib.util.module_from_spec(spec)
spec.loader.exec_module(deployment)


class DeploymentTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.base = Path(self.temporary.name)
        self.root = self.base / 'site'

    def archive(self, commit, content=b'<h1>Documentation</h1>', *, wrong_digest=False, extra=None, link=False):
        file_digest = hashlib.sha256(content).hexdigest()
        manifest = {'version': 1, 'sourceCommit': commit, 'files': {'index.html': '0' * 64 if wrong_digest else file_digest}}
        path = self.base / (commit + '.tar.gz')
        with tarfile.open(path, 'w:gz') as archive:
            data = {'index.html': content, 'site-manifest.json': json.dumps(manifest).encode()}
            if extra:
                data[extra] = b'extra'
            for name, body in data.items():
                member = tarfile.TarInfo('./' + name)
                member.size = len(body)
                archive.addfile(member, io.BytesIO(body))
            if link:
                member = tarfile.TarInfo('asset.html')
                member.type = tarfile.SYMTYPE
                member.linkname = '/etc/passwd'
                archive.addfile(member)
        return path

    def test_activate_new_release_keep_previous_and_allow_exact_retry(self):
        first, second = 'a' * 40, 'b' * 40
        first_archive = self.archive(first)
        deployment.deploy(self.root, first_archive, first)
        previous = (self.root / 'current').resolve()
        second_archive = self.archive(second, b'<h1>Updated documentation</h1>')
        deployment.deploy(self.root, second_archive, second)
        active = (self.root / 'current').resolve()
        self.assertEqual(active.name, second)
        self.assertEqual((previous / 'index.html').read_bytes(), b'<h1>Documentation</h1>')
        deployment.deploy(self.root, second_archive, second)
        self.assertEqual((self.root / 'current').resolve(), active)

    def test_invalid_candidate_preserves_current_and_cannot_escape(self):
        first = 'a' * 40
        deployment.deploy(self.root, self.archive(first), first)
        active = (self.root / 'current').resolve()
        for scenario in [dict(wrong_digest=True), dict(extra='unlisted.html'), dict(extra='../outside.html'), dict(link=True)]:
            with self.subTest(scenario=scenario):
                candidate = 'c' * 40
                with self.assertRaises(ValueError):
                    deployment.deploy(self.root, self.archive(candidate, **scenario), candidate)
                self.assertEqual((self.root / 'current').resolve(), active)
                self.assertFalse((self.root / 'releases' / candidate).exists())
                self.assertFalse((self.root / 'releases' / 'outside.html').exists())

    def test_source_commit_binding_and_immutable_release(self):
        first = 'a' * 40
        deployment.deploy(self.root, self.archive(first), first)
        active = (self.root / 'current').resolve()
        with self.assertRaises(ValueError):
            deployment.deploy(self.root, self.archive('b' * 40), 'c' * 40)
        with self.assertRaises(ValueError):
            deployment.deploy(self.root, self.archive(first, b'<h1>Different bytes</h1>'), first)
        self.assertEqual((self.root / 'current').resolve(), active)
        self.assertEqual((active / 'index.html').read_bytes(), b'<h1>Documentation</h1>')

    def test_existing_current_directory_is_preserved(self):
        current = self.root / 'current'
        current.mkdir(parents=True)
        (current / 'existing.txt').write_text('preserve')
        with self.assertRaises(ValueError):
            deployment.deploy(self.root, self.archive('a' * 40), 'a' * 40)
        self.assertEqual((current / 'existing.txt').read_text(), 'preserve')

    def test_private_caller_umask_still_produces_readable_static_files(self):
        commit = 'a' * 40
        archive = self.archive(commit)
        previous_umask = os.umask(0o077)
        try:
            deployment.deploy(self.root, archive, commit)
        finally:
            os.umask(previous_umask)
        for directory in [self.root, self.root / 'releases', self.root / 'current']:
            self.assertEqual(stat.S_IMODE(directory.stat().st_mode), 0o755)
        self.assertEqual(stat.S_IMODE((self.root / 'current/index.html').stat().st_mode), 0o644)


if __name__ == '__main__':
    unittest.main()
