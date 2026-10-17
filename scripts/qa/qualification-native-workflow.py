#!/usr/bin/env python3
"""Small fixed-command wrapper for the one native capability workflow.

Dependency output is summarized, never emitted verbatim. This wrapper does not
run Chrome, alter host security, upload artifacts, or choose another toolchain.
"""
import hashlib
import json
import os
import pathlib
import platform
import subprocess
import sys
import tempfile
import time
import urllib.request

PARENT = "dab22222b66f5732a87dfde04d1c54569fcc960b"
BASELINE = "e49a16e9f7f5c5000eea56bafa1c7c3bf75fa1eb"
URL = "https://storage.googleapis.com/chrome-for-testing-public/155.0.8059.79/linux64/chrome-linux64.zip"
ARCHIVE_SHA = "bcd9a79130d7e44d70f93be87042e9bcee7fe0f0b3898e06b8c9bed5fb619dcd"
ROOT = pathlib.Path(__file__).resolve().parents[2]
APP_PATHS = ["src", "public", "drizzle", "package.json", "package-lock.json", "next.config.ts", "tsconfig.json", "postcss.config.mjs"]
CHANGED_PATHS = {
    ".github/workflows/qualification-compatibility.yml",
    "scripts/facility/qualification-native-observer.py",
    "scripts/facility/qualification-native-smoke.mjs",
    "scripts/qa/qualification-native-workflow.py",
    "scripts/qa/qualification-native-observer.test.py",
    "scripts/qa/qualification-native-smoke.test.mjs",
}


def emit(value):
    data = json.dumps(value, sort_keys=True, ensure_ascii=True)
    if len(data) > 32768:
        raise RuntimeError("receipt-too-large")
    print("GN_NATIVE_WORKFLOW " + data, flush=True)


def git(*args):
    return subprocess.check_output(["git", *args], cwd=ROOT, text=True, timeout=15).strip()


def need(condition, code):
    if not condition:
        raise RuntimeError(code)


def bind():
    env = os.environ
    need(env.get("GITHUB_REPOSITORY") == "holdini25/GridNinjaSite", "wrong-repository")
    need(env.get("GITHUB_EVENT_NAME") == "push" and env.get("GITHUB_RUN_ATTEMPT") == "1", "wrong-event-or-attempt")
    need(env.get("GITHUB_REF") == "refs/heads/codex/qualification-compatibility", "wrong-ref")
    need(platform.system() == "Linux" and platform.machine() == "x86_64" and os.getuid() > 0, "wrong-runtime")
    os_release = platform.freedesktop_os_release()
    need(os_release.get("ID") == "ubuntu" and os_release.get("VERSION_ID") == "26.04", "wrong-ubuntu-image")
    head = git("rev-parse", "HEAD")
    need(head == env.get("GITHUB_SHA") == env.get("GN_NATIVE_WORKFLOW_SHA"), "head-mismatch")
    need(git("rev-parse", "HEAD^") == env.get("GN_NATIVE_PARENT") == PARENT, "parent-mismatch")
    need(git("status", "--porcelain", "--untracked-files=no") == "", "tracked-source-dirty")
    changed = set(git("diff", "--name-only", PARENT, "HEAD").splitlines())
    need(changed and changed <= CHANGED_PATHS, "unexpected-source-change")
    need(git("diff", "--name-only", BASELINE, "HEAD", "--", *APP_PATHS) == "", "application-or-lock-changed")
    need(git("diff", "--name-only", PARENT, "HEAD", "--", "vercel.json", "tools/qualification") == "", "deployment-or-tool-pins-changed")
    node = subprocess.check_output(["node", "--version"], text=True, timeout=10).strip()
    need(node == "v22.23.2", "wrong-node")
    files = {}
    for name in sorted(CHANGED_PATHS | {"package-lock.json", "tools/qualification/package-lock.json", "vercel.json", "scripts/facility/qualification-sandbox-provision.py"}):
        data = (ROOT / name).read_bytes()
        files[name] = {"bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()}
    emit({"phase": "source", "status": "PASS", "head": head, "parent": PARENT,
          "tree": git("rev-parse", "HEAD^{tree}"), "baseline": BASELINE,
          "node": node, "runId": env.get("GITHUB_RUN_ID"), "attempt": 1,
          "imageOS": env.get("ImageOS"), "imageVersion": env.get("ImageVersion"),
          "kernel": platform.release(), "osRelease": {key: os_release.get(key) for key in ["ID", "VERSION_ID", "VERSION"]},
          "cpuCount": os.cpu_count(), "files": files, "matrixStarted": False})


def install(which):
    command = ["npm", "ci", "--ignore-scripts", "--no-audit", "--no-fund"]
    if which == "tools":
        command += ["--prefix", "tools/qualification"]
    with tempfile.TemporaryFile() as output:
        started = time.monotonic()
        completed = subprocess.run(["timeout", "--signal=TERM", "--kill-after=10s", "240s", *command],
                                   cwd=ROOT, stdout=output, stderr=subprocess.STDOUT, timeout=260)
        size = output.tell()
        output.seek(0)
        digest = hashlib.file_digest(output, "sha256").hexdigest()
    emit({"phase": "install-" + which, "status": "PASS" if completed.returncode == 0 else "FAIL",
          "exitCode": completed.returncode, "outputBytes": size, "outputSha256": digest,
          "seconds": round(time.monotonic() - started, 3), "lifecycleScripts": False,
          "rawOutputSuppressed": True})
    need(completed.returncode == 0, "dependency-install-failed")


def download():
    directory = pathlib.Path(tempfile.mkdtemp(prefix="gridninja-native-", dir=os.environ["RUNNER_TEMP"]))
    archive = directory / "chrome-linux64.zip"
    digest = hashlib.sha256()
    size = 0
    deadline = time.monotonic() + 120
    with urllib.request.urlopen(URL, timeout=20) as response, archive.open("xb") as output:
        need(response.geturl() == URL, "unexpected-download-redirect")
        while True:
            chunk = response.read(1024 * 1024)
            if not chunk:
                break
            size += len(chunk)
            need(size <= 512 * 1024 * 1024 and time.monotonic() < deadline, "download-bound-exceeded")
            digest.update(chunk)
            output.write(chunk)
    need(digest.hexdigest() == ARCHIVE_SHA, "archive-digest-mismatch")
    need("\n" not in str(archive) and "\r" not in str(archive), "invalid-archive-path")
    with open(os.environ["GITHUB_ENV"], "a", encoding="utf8") as output:
        output.write("GN_CFT_ARCHIVE=" + str(archive) + "\n")
    emit({"phase": "download", "status": "PASS", "url": URL, "bytes": size,
          "sha256": digest.hexdigest(), "browserExecuted": False})


def main():
    action = sys.argv[1] if len(sys.argv) == 2 else ""
    try:
        os.chdir(ROOT)
        if action == "bind":
            bind()
        elif action in {"install-root", "install-tools"}:
            install(action.removeprefix("install-"))
        elif action == "download":
            download()
        else:
            raise RuntimeError("unknown-action")
    except Exception as error:
        code = str(error) if type(error) is RuntimeError and str(error).replace("-", "").isalnum() else "workflow-step-failed"
        emit({"phase": action, "status": "FAIL", "code": code, "errorType": type(error).__name__,
              "matrixStarted": False, "retryAuthorized": False})
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
