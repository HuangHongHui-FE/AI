#!/usr/bin/env python3
"""Local client for the 美基星图 (wx740b0c9e327a98b1) backend.

The release mini-program only talks to https://www.enlee.cloud. This module
reproduces its request headers and response decryption, so the same data can be
used outside WeChat.

Token: read from token.txt (or MEIJI_TOKEN). Tokens are user-bound and expire
after ~50 minutes; run refresh_token.py to capture a fresh one.
"""
import argparse
import base64
import gzip
import hashlib
import hmac
import json
import os
import struct
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
BASE = "https://www.enlee.cloud"
APP_ID = "wx740b0c9e327a98b1"
CLIENT_SOURCE = "starM"
CLIENT_VERSION = "1.1.0"
CIPHER_SECRET = "finlens-change-me-and-rotate-often160"
UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36 "
      "MicroMessenger/7.0.20.1781(0x6700143B) NetType/WIFI "
      "MiniProgramEnv/Mac MacWechat/WMPF MacWechat/3.8.7(0x13080712) "
      "UnifiedPCMacWechat(0xf2641f37) XWEB/25800")
REFERER = "https://servicewechat.com/%s/11/page-frame.html" % APP_ID


class TokenExpired(RuntimeError):
    pass


def decrypt_payload(payload):
    """Mirror of utils/cipher.js decryptPayload (HMAC-SHA256 keystream XOR)."""
    raw = base64.b64decode(payload)
    nonce, cipher = raw[:16], raw[16:]
    key = CIPHER_SECRET.encode()
    out = bytearray(len(cipher))
    for block in range((len(cipher) + 31) // 32):
        ks = hmac.new(key, nonce + struct.pack(">I", block), hashlib.sha256).digest()
        off = block * 32
        for i, b in enumerate(cipher[off:off + 32]):
            out[off + i] = b ^ ks[i]
    return out.decode("utf-8")


def read_token():
    token = os.environ.get("MEIJI_TOKEN", "").strip()
    if token:
        return token
    path = os.path.join(HERE, "token.txt")
    with open(path, encoding="utf-8") as f:
        return f.read().strip()


def token_info(token):
    try:
        part = token.split(".")[0]
        return json.loads(base64.urlsafe_b64decode(part + "=" * (-len(part) % 4)))
    except Exception:
        return {}


class MeijiClient:
    def __init__(self, token=None, timeout=20):
        self.token = token or read_token()
        self.timeout = timeout
        self.info = token_info(self.token)
        if not self.info.get("uid"):
            raise TokenExpired("token.txt is not a 美基星图 token")
        exp = self.info.get("exp")
        if isinstance(exp, (int, float)) and exp < time.time():
            raise TokenExpired("token expired at %s; run refresh_token.py"
                               % time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(exp)))

    # ---- transport -------------------------------------------------------
    def _headers(self):
        return {
            "Authorization": "Bearer " + self.token,
            "Accept": "application/json",
            "User-Agent": UA,
            "xweb_xhr": "1",
            "X-Finlens-Client-Source": CLIENT_SOURCE,
            "X-Finlens-Client-Version": CLIENT_VERSION,
            "X-Finlens-User-Id": self.info["uid"],
            "Referer": REFERER,
        }

    def get(self, path, params=None):
        params = dict(params or {})
        params.setdefault("clientSource", CLIENT_SOURCE)
        params.setdefault("clientVersion", CLIENT_VERSION)
        url = BASE + path + "?" + urllib.parse.urlencode(params)
        req = urllib.request.Request(url, headers=self._headers())
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                body = resp.read()
                enc = resp.headers.get("X-Finlens-Enc")
        except urllib.error.HTTPError as e:
            body = e.read()
            text = body.decode("utf-8", "replace")
            if e.code in (401, 403):
                raise TokenExpired("HTTP %d from %s; run refresh_token.py (%s)"
                                   % (e.code, path, text[:160])) from None
            raise RuntimeError("HTTP %d from %s: %s" % (e.code, path, text[:300])) from None
        if body[:2] == b"\x1f\x8b":
            body = gzip.decompress(body)
        text = body.decode("utf-8")
        if enc == "1":
            return json.loads(decrypt_payload(json.loads(text)["d"]))
        return json.loads(text)

    # ---- raw endpoints ---------------------------------------------------
    def config(self):
        return self.get("/api/v3/star/config")

    def meta(self, page="home"):
        return self.get("/api/v3/star/meta", {"page": page})

    def quotes(self, page="home", mode="realtime"):
        return self.get("/api/v3/star/quotes", {"page": page, "quoteMode": mode})

    def economy(self):
        return self.get("/api/v3/star/economy")

    def indices(self):
        return self.get("/api/v3/star/indices")

    def market_clock(self):
        return self.get("/api/v3/star/market-clock")

    def heatmap(self, mode="realtime"):
        return self.get("/api/v3/star/heatmap", {"quoteMode": mode})

    def gold_config(self):
        return self.get("/api/v3/gold/config")

    def gold_home(self):
        return self.get("/api/v3/gold/home")

    def gold_brands(self):
        return self.get("/api/v3/gold/brands")

    # ---- joined views ----------------------------------------------------
    @staticmethod
    def _chg(v):
        return None if v is None else ("%+.2f%%" % v)

    @staticmethod
    def _trend(v):
        if v is None:
            return "none"
        return "up" if v > 0 else "down" if v < 0 else "flat"

    def _home_rows(self, meta, quotes, mode):
        values = {x["c"]: x["v"] for x in quotes.get("s", [])}
        rows = []
        for sec in meta.get("sections", []):
            for tab in sec.get("tabs", []):
                for item in tab.get("list", []):
                    code = item.get("code")
                    v = values.get(code)
                    rows.append({
                        "code": code,
                        "name": item.get("name"),
                        "icon": item.get("img", ""),
                        "value": v,
                        "chg": self._chg(v),
                        "trend": self._trend(v),
                        "section": sec.get("id"),
                        "tab": tab.get("key"),
                    })
        return {
            "mode": mode,
            "statusText": quotes.get("sectorStatusText"),
            "statusColor": quotes.get("sectorStatusColor"),
            "rows": rows,
        }

    def home_rows(self, mode="realtime"):
        return self._home_rows(self.meta("home"), self.quotes("home", mode), mode)

    def _asia_rows(self, meta, quotes, mode):
        values = {x["c"]: x["v"] for x in quotes.get("s", [])}
        markets = quotes.get("m") or {}
        out = []
        for sec in meta.get("sections", []):
            items = []
            for tab in sec.get("tabs", []):
                for item in tab.get("list", []):
                    v = values.get(item.get("code"))
                    items.append({
                        "code": item.get("code"),
                        "name": item.get("name"),
                        "value": v,
                        "chg": self._chg(v),
                        "trend": self._trend(v),
                    })
            out.append({
                "id": sec.get("id"),
                "name": sec.get("name"),
                "market": sec.get("market"),
                "marketState": markets.get(sec.get("market")),
                "items": items,
            })
        return {"mode": mode, "sections": out}

    def asia_rows(self, mode="realtime"):
        return self._asia_rows(self.meta("asia"), self.quotes("asia", mode), mode)

    @staticmethod
    def _gold_tab(cfg, home, brands):
        """The subset the 星图 '黄金' tab shows (config.gold whitelist)."""
        gcfg = (cfg.get("gold") or {})
        symbols = set(gcfg.get("symbols") or [])
        section_keys = set(gcfg.get("sectionKeys") or [])
        brand_groups = set(gcfg.get("brandGroups") or [])
        sections = []
        for sec in home.get("sections", []):
            if section_keys and sec.get("key") not in section_keys:
                continue
            items = [it for it in sec.get("items", [])
                     if not symbols or it.get("symbol") in symbols]
            sections.append({**sec, "items": items})
        groups = [g for g in brands.get("groups", [])
                  if not brand_groups or g.get("group") in brand_groups]
        return {
            "benchmark": home.get("benchmark"),
            "sections": sections,
            "fx": home.get("fx"),
            "brands": {**brands, "groups": groups},
        }

    def gold_tab(self):
        return self._gold_tab(self.config(), self.gold_home(), self.gold_brands())

    def snapshot(self, outdir=None):
        outdir = outdir or os.path.join(HERE, "snapshot")
        os.makedirs(outdir, exist_ok=True)
        data = {
            "config": self.config(),
            "meta_home": self.meta("home"),
            "meta_asia": self.meta("asia"),
            "quotes_home_rt": self.quotes("home", "realtime"),
            "quotes_home_close": self.quotes("home", "previousTradingDay"),
            "quotes_asia_rt": self.quotes("asia", "realtime"),
            "quotes_asia_close": self.quotes("asia", "previousTradingDay"),
            "economy": self.economy(),
            "indices": self.indices(),
            "market_clock": self.market_clock(),
            "heatmap_rt": self.heatmap("realtime"),
            "heatmap_close": self.heatmap("previousTradingDay"),
            "gold_config": self.gold_config(),
            "gold_home": self.gold_home(),
            "gold_brands": self.gold_brands(),
        }
        for name, value in data.items():
            with open(os.path.join(outdir, name + ".json"), "w", encoding="utf-8") as f:
                json.dump(value, f, ensure_ascii=False, indent=2)
        summary = {
            "fetchedAt": time.strftime("%Y-%m-%d %H:%M:%S %z"),
            "token": {"uid": self.info.get("uid"), "exp": self.info.get("exp")},
            "home": self._home_rows(data["meta_home"], data["quotes_home_rt"], "realtime"),
            "asia": self._asia_rows(data["meta_asia"], data["quotes_asia_rt"], "realtime"),
            "gold": self._gold_tab(data["config"], data["gold_home"], data["gold_brands"]),
            "economy": data["economy"],
            "marketClock": data["market_clock"],
        }
        with open(os.path.join(outdir, "summary.json"), "w", encoding="utf-8") as f:
            json.dump(summary, f, ensure_ascii=False, indent=2)
        return outdir


def main():
    p = argparse.ArgumentParser(description="美基星图 backend client")
    p.add_argument("command", choices=[
        "token", "config", "home", "asia", "gold", "economy", "indices",
        "market-clock", "heatmap", "gold-config", "gold-home", "gold-brands",
        "snapshot",
    ])
    p.add_argument("arg", nargs="?", help="quote mode for heatmap, or output dir for snapshot")
    args = p.parse_args()
    c = MeijiClient()
    if args.command == "token":
        exp = c.info.get("exp")
        print(json.dumps({
            "uid": c.info.get("uid"),
            "exp": exp,
            "exp_local": time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(exp)) if exp else None,
            "seconds_left": int(exp - time.time()) if exp else None,
        }, ensure_ascii=False, indent=2))
        return
    dispatch = {
        "config": c.config,
        "home": c.home_rows,
        "asia": c.asia_rows,
        "gold": c.gold_tab,
        "economy": c.economy,
        "indices": c.indices,
        "market-clock": c.market_clock,
        "heatmap": lambda: c.heatmap(args.arg or "realtime"),
        "gold-config": c.gold_config,
        "gold-home": c.gold_home,
        "gold-brands": c.gold_brands,
        "snapshot": lambda: {"outdir": c.snapshot(args.arg)},
    }
    print(json.dumps(dispatch[args.command](), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    try:
        main()
    except TokenExpired as e:
        print("TOKEN_EXPIRED: %s" % e, file=sys.stderr)
        sys.exit(2)
