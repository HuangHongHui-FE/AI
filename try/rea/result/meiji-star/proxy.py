#!/usr/bin/env python3
"""Minimal CONNECT proxy that TLS-intercepts only www.enlee.cloud.

Other hosts are tunnelled to the existing local proxy (Clash at 127.0.0.1:7897).
Captured requests/responses are written to /tmp/rea-mitm/capture.jsonl.
"""
import json
import os
import select
import socket
import socketserver
import ssl
import sys
import threading
import time

LISTEN = ("127.0.0.1", 8080)
CLASH = ("127.0.0.1", 7897)
TARGET = "www.enlee.cloud"
HERE = os.path.dirname(os.path.abspath(__file__))
CAP = os.path.join(HERE, "capture.jsonl")
BODIES = os.path.join(HERE, "bodies")
os.makedirs(BODIES, exist_ok=True)
lock = threading.Lock()

server_ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
server_ctx.load_cert_chain(os.path.join(HERE, "srv.crt"), os.path.join(HERE, "srv.key"))
server_ctx.set_alpn_protocols(["http/1.1"])
upstream_ctx = ssl.create_default_context()


def log(obj):
    with lock:
        with open(CAP, "a", encoding="utf-8") as f:
            f.write(json.dumps(obj, ensure_ascii=False) + "\n")


def read_headers(sock):
    data = b""
    while b"\r\n\r\n" not in data and len(data) < 65536:
        chunk = sock.recv(4096)
        if not chunk:
            return None, None
        data += chunk
    head, _, rest = data.partition(b"\r\n\r\n")
    return head, rest


def parse_connect(head):
    line = head.split(b"\r\n", 1)[0].decode("latin-1")
    parts = line.split()
    if len(parts) < 2:
        return None
    hostport = parts[1]
    if hostport.startswith("["):
        host, _, port = hostport[1:].partition("]:")
    else:
        host, _, port = hostport.partition(":")
    return host, int(port or 443)


def relay(a, b):
    socks = [a, b]
    while True:
        r, _, x = select.select(socks, [], socks, 30)
        if x or not r:
            break
        for s in r:
            try:
                data = s.recv(65536)
            except OSError:
                return
            if not data:
                return
            other = b if s is a else a
            try:
                other.sendall(data)
            except OSError:
                return


def upstream_request(method, path, headers, body):
    import http.client
    conn = http.client.HTTPSConnection(TARGET, 443, context=upstream_ctx, timeout=15)
    fwd = {}
    for k, v in headers:
        lk = k.lower()
        if lk in ("host", "proxy-connection", "connection", "accept-encoding", "content-length"):
            continue
        fwd[k] = v
    fwd["Accept-Encoding"] = "identity"
    fwd["Host"] = TARGET
    conn.request(method, path, body=body, headers=fwd)
    resp = conn.getresponse()
    data = resp.read()
    out_headers = [(k, v) for k, v in resp.getheaders()
                   if k.lower() not in ("transfer-encoding", "connection", "content-length",
                                        "content-encoding", "keep-alive")]
    out_headers.append(("Content-Length", str(len(data))))
    out_headers.append(("Connection", "close"))
    conn.close()
    return resp.status, resp.reason, out_headers, data


def handle_http(tls_sock):
    f = tls_sock.makefile("rb")
    while True:
        request_line = f.readline()
        if not request_line:
            return
        try:
            method, path, _ver = request_line.decode("latin-1").strip().split(" ", 2)
        except ValueError:
            return
        headers = []
        while True:
            line = f.readline()
            if line in (b"\r\n", b"\n", b""):
                break
            k, _, v = line.decode("latin-1").partition(":")
            headers.append((k.strip(), v.strip()))
        hmap = {k.lower(): v for k, v in headers}
        body = b""
        if "content-length" in hmap:
            try:
                n = int(hmap["content-length"])
            except ValueError:
                n = 0
            body = f.read(n)
        ts = time.strftime("%Y%m%d-%H%M%S")
        try:
            status, reason, out_headers, data = upstream_request(method, path, headers, body)
        except Exception as e:  # noqa: BLE001
            log({"ts": time.time(), "error": repr(e), "method": method, "path": path,
                 "req_headers": headers, "req_body": body.decode("utf-8", "replace")})
            tls_sock.sendall(b"HTTP/1.1 502 Bad Gateway\r\nContent-Length: 0\r\nConnection: close\r\n\r\n")
            return
        auth = hmap.get("authorization", "")
        safe_headers = [("Authorization", "<redacted>") if k.lower() == "authorization" else (k, v)
                        for k, v in headers]
        req_text = body.decode("utf-8", "replace")
        if "/auth/login" in path:
            try:
                j = json.loads(req_text)
                if isinstance(j, dict) and "code" in j:
                    j["code"] = "<redacted>"
                req_text = json.dumps(j, ensure_ascii=False)
            except Exception:
                pass
        log({
            "ts": time.time(),
            "method": method,
            "path": path,
            "req_headers": safe_headers,
            "req_body": req_text,
            "status": status,
            "resp_headers": out_headers,
            "resp_body": data.decode("utf-8", "replace"),
        })
        if auth.startswith("Bearer "):
            token_path = os.path.join(HERE, "token.txt")
            with open(token_path, "w", encoding="utf-8") as tf:
                tf.write(auth[len("Bearer "):].strip() + "\n")
            os.chmod(token_path, 0o600)
            print("[capture] got token for %s %s" % (method, path), flush=True)
        name = "%s_%s_%s.json" % (ts, method, path.replace("/", "_").replace("?", "_")[:80])
        try:
            with open(os.path.join(BODIES, name), "w", encoding="utf-8") as bf:
                bf.write(data.decode("utf-8", "replace"))
        except OSError:
            pass
        resp = ["HTTP/1.1 %d %s" % (status, reason or "OK")]
        resp += ["%s: %s" % (k, v) for k, v in out_headers]
        tls_sock.sendall(("\r\n".join(resp) + "\r\n\r\n").encode("latin-1") + data)
        return  # one request per connection; the client reconnects


class Handler(socketserver.BaseRequestHandler):
    def handle(self):
        try:
            head, rest = read_headers(self.request)
            if not head:
                return
            line = head.split(b"\r\n", 1)[0].decode("latin-1")
            if not line.upper().startswith("CONNECT "):
                self.request.sendall(b"HTTP/1.1 405 Method Not Allowed\r\nContent-Length: 0\r\n\r\n")
                return
            host, port = parse_connect(head)
            if host == TARGET:
                self.request.sendall(b"HTTP/1.1 200 Connection Established\r\n\r\n")
                tls = server_ctx.wrap_socket(self.request, server_side=True)
                try:
                    handle_http(tls)
                finally:
                    try:
                        tls.close()
                    except OSError:
                        pass
                return
            up = socket.create_connection(CLASH, timeout=10)
            up.sendall(head + b"\r\n\r\n" + (rest or b""))
            resp = b""
            while b"\r\n\r\n" not in resp:
                chunk = up.recv(4096)
                if not chunk:
                    break
                resp += chunk
            self.request.sendall(resp)
            relay(self.request, up)
        except Exception as e:  # noqa: BLE001
            print("[proxy] error: %r" % (e,), flush=True)


class Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


if __name__ == "__main__":
    print("[proxy] listening on %s:%d, intercepting %s" % (LISTEN[0], LISTEN[1], TARGET), flush=True)
    Server(LISTEN, Handler).serve_forever()
