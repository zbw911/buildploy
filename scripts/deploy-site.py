#!/usr/bin/env python3
"""Verify a static site archive and atomically activate its source commit."""
import argparse
import fcntl
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import tarfile
import tempfile
import uuid


def relative_path(value):
    path = PurePosixPath(value)
    if not value or path.is_absolute() or '..' in path.parts or '\\' in value or path.as_posix() != value:
        raise ValueError('Invalid archive path: ' + value)
    return path


def verify(directory, source_commit):
    manifest_path = directory / 'site-manifest.json'
    if manifest_path.is_symlink():
        raise ValueError('Manifest must be a regular deployment file.')
    manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
    if not isinstance(manifest, dict):
        raise ValueError('Manifest must be a JSON object.')
    files = manifest.get('files')
    if manifest.get('version') != 1 or manifest.get('sourceCommit') != source_commit or not isinstance(files, dict) or 'index.html' not in files:
        raise ValueError('Manifest does not identify the expected site source commit.')
    expected = set()
    for name, digest in files.items():
        relative_path(name)
        if name == 'site-manifest.json' or not isinstance(digest, str) or not re.fullmatch('[a-f0-9]{64}', digest):
            raise ValueError('Invalid manifest entry: ' + name)
        expected.add(name)
    actual = set()
    for path in directory.rglob('*'):
        if path.is_symlink():
            raise ValueError('Symbolic links are not deployment files.')
        if path.is_file():
            actual.add(path.relative_to(directory).as_posix())
        elif not path.is_dir():
            raise ValueError('Unsupported deployment file.')
    if actual != expected | {'site-manifest.json'}:
        raise ValueError('Archive file list differs from its manifest.')
    for name, digest in files.items():
        if hashlib.sha256((directory / name).read_bytes()).hexdigest() != digest:
            raise ValueError('Deployment checksum mismatch: ' + name)
    return manifest


def unpack(archive, destination):
    seen = set()
    total_bytes = 0
    with tarfile.open(archive, 'r:*') as source:
        for member in source:
            name = member.name
            while name.startswith('./'):
                name = name[2:]
            if name in ('', '.') and member.isdir():
                continue
            path = relative_path(name)
            if name in seen:
                raise ValueError('Duplicate archive path: ' + name)
            seen.add(name)
            total_bytes += member.size
            if len(seen) > 10000 or total_bytes > 128 * 1024 * 1024:
                raise ValueError('Static site archive exceeds deployment limits.')
            target = destination.joinpath(*path.parts)
            if member.isdir():
                target.mkdir(parents=True, exist_ok=True)
            elif member.isfile():
                target.parent.mkdir(parents=True, exist_ok=True)
                with source.extractfile(member) as data, target.open('xb') as output:
                    shutil.copyfileobj(data, output)
                target.chmod(0o644)
            else:
                raise ValueError('Archive links and special files are not allowed: ' + name)


def deploy(root, archive, source_commit):
    if not re.fullmatch('[a-f0-9]{40}', source_commit):
        raise ValueError('Expected a full source commit SHA.')
    root = root.absolute()
    if root == Path('/') or root.is_symlink():
        raise ValueError('Deployment root must be an independent directory.')
    root_was_missing = not root.exists()
    root.mkdir(parents=True, exist_ok=True)
    if root_was_missing:
        root.chmod(0o755)
    with (root / '.deploy.lock').open('a') as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise RuntimeError('Another document deployment is running.') from None
        releases = root / 'releases'
        if releases.is_symlink():
            raise ValueError('Release directory must not be a symbolic link.')
        releases_was_missing = not releases.exists()
        releases.mkdir(exist_ok=True)
        if releases_was_missing:
            releases.chmod(0o755)
        current = root / 'current'
        if current.exists() and not current.is_symlink():
            raise ValueError('Refusing to replace an existing current directory.')
        if current.is_symlink() and not current.resolve().is_relative_to(releases.resolve()):
            raise ValueError('Current version points outside the release directory.')
        release = releases / source_commit
        with tempfile.TemporaryDirectory(prefix='.staging-', dir=releases) as temporary:
            candidate = Path(temporary)
            unpack(archive, candidate)
            manifest = verify(candidate, source_commit)
            candidate.chmod(0o755)
            for directory in candidate.rglob('*'):
                if directory.is_dir():
                    directory.chmod(0o755)
            if release.exists() or release.is_symlink():
                if release.is_symlink() or verify(release, source_commit) != manifest:
                    raise ValueError('A different immutable release already uses this source commit.')
            else:
                candidate.rename(release)
        link = root / ('.current-' + uuid.uuid4().hex)
        try:
            link.symlink_to(Path('releases') / source_commit, target_is_directory=True)
            os.replace(link, current)
        finally:
            link.unlink(missing_ok=True)
        return {'sourceCommit': source_commit, 'files': len(manifest['files']), 'current': str(current), 'release': str(release)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, required=True)
    parser.add_argument('--archive', type=Path, required=True)
    parser.add_argument('--source-commit', required=True)
    arguments = parser.parse_args()
    try:
        result = deploy(arguments.root, arguments.archive, arguments.source_commit)
    except (OSError, ValueError, RuntimeError, tarfile.TarError) as error:
        parser.exit(1, str(error) + '\n')
    print(json.dumps(result, ensure_ascii=False))


if __name__ == '__main__':
    main()
