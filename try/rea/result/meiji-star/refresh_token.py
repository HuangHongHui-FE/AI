#!/usr/bin/env python3
"""Capture a fresh 美基星图 mini-program bearer token.

Flow: start local MITM proxy -> trust temporary CA -> point the macOS HTTPS proxy
at it -> open the mini-program (it polls every second) -> read the Authorization
header -> restore proxy, remove CA, stop proxy.

Only the secure web proxy is changed, and it is restored in a finally block.
No sudo is needed when the user is an admin and the login keychain is unlocked.
"""
import base64
import json
import os
import re
import socket
import subprocess
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
PROXY = os.path.join(HERE, "proxy.py")
TOKEN = os.path.join(HERE, "token.txt")
CA = os.path.join(HERE, "ca.crt")
SERVICE = "Wi-Fi"
PORT = 8080
DEEP_LINK = ("weixin://dl/business/?appid=wx740b0c9e327a98b1"
             "&path=pages/index/index&env_version=release")
LOGIN_KEYCHAIN = os.path.expanduser("~/Library/Keychains/login.keychain-db")


def run(cmd):
    return subprocess.run(cmd, capture_output=True, text=True)


def get_secure_proxy():
    out = run(["networksetup", "-getsecurewebproxy", SERVICE]).stdout
    enabled = bool(re.search(r"Enabled:\s*Yes", out))
    server = (re.search(r"Server:\s*(.*)", out) or [None, ""])[1].strip()
    port_m = re.search(r"Port:\s*(\d+)", out)
    port = int(port_m.group(1)) if port_m else 0
    return enabled, server, port


def restore_proxy(saved):
    enabled, server, port = saved
    if enabled and server and port:
        run(["networksetup", "-setsecurewebproxy", SERVICE, server, str(port)])
    else:
        run(["networksetup", "-setsecurewebproxystate", SERVICE, "off"])


def wait_port(port, timeout=5.0):
    end = time.time() + timeout
    while time.time() < end:
        s = socket.socket()
        s.settimeout(0.2)
        try:
            if s.connect_ex(("127.0.0.1", port)) == 0:
                return True
        finally:
            s.close()
        time.sleep(0.1)
    return False


def token_payload(tok):
    try:
        part = tok.split(".")[0]
        return json.loads(base64.urlsafe_b64decode(part + "=" * (-len(part) % 4)))
    except Exception:
        return {}


def main():
    if not os.path.exists(CA):
        print("missing ca.crt; run gen_certs.sh first", file=sys.stderr)
        return 2
    saved = get_secure_proxy()
    proc = None
    cert_added = False
    try:
        # Stop a stale proxy on the same port.
        out = run(["lsof", "-nP", "-iTCP:%d" % PORT, "-sTCP:LISTEN"]).stdout
        for line in out.splitlines()[1:]:
            pid = line.split()[1]
            if pid.isdigit():
                run(["kill", pid])
        time.sleep(0.3)

        log = open(os.path.join(HERE, "proxy.log"), "a")
        proc = subprocess.Popen([sys.executable, PROXY], cwd=HERE,
                                stdout=log, stderr=log)
        if not wait_port(PORT):
            print("proxy failed to listen", file=sys.stderr)
            return 3

        r = run(["security", "add-trusted-cert", "-r", "trustRoot",
                 "-k", LOGIN_KEYCHAIN, CA])
        if r.returncode != 0:
            print("failed to trust CA: %s" % (r.stderr or r.stdout), file=sys.stderr)
            return 4
        cert_added = True

        run(["networksetup", "-setsecurewebproxy", SERVICE, "127.0.0.1", str(PORT)])
        try:
            os.remove(TOKEN)
        except FileNotFoundError:
            pass

        run(["open", DEEP_LINK])
        print("waiting for the mini-program to send an authenticated request "
              "(keep 美基星图 in the foreground)...", flush=True)
        end = time.time() + 120
        while time.time() < end:
            if os.path.exists(TOKEN) and os.path.getsize(TOKEN) > 20:
                tok = open(TOKEN, encoding="utf-8").read().strip()
                info = token_payload(tok)
                print(json.dumps({"ok": True, "uid": info.get("uid"),
                                  "exp": info.get("exp"),
                                  "token_prefix": tok[:12] + "...",
                                  "token_file": TOKEN}, ensure_ascii=False))
                return 0
            time.sleep(0.5)
        print("timed out waiting for a token", file=sys.stderr)
        return 5
    finally:
        restore_proxy(saved)
        if cert_added:
            run(["security", "delete-certificate", "-c", "REA Local CA", LOGIN_KEYCHAIN])
        if proc is not None:
            proc.terminate()
            try:
                proc.wait(timeout=3)
            except subprocess.TimeoutExpired:
                proc.kill()


if __name__ == "__main__":
    sys.exit(main())
