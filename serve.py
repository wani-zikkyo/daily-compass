from __future__ import annotations

import argparse
import hashlib
import hmac
import json
import os
import secrets
import socket
import time
from datetime import datetime
from http.cookies import SimpleCookie
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, unquote


ROOT = Path(__file__).resolve().parent
DEFAULT_HOST = "0.0.0.0"


def load_env_file(path: Path) -> None:
    if not path.exists():
        return
    try:
        lines = path.read_text(encoding="utf-8").splitlines()
    except OSError:
        return
    for line in lines:
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, value = stripped.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


load_env_file(ROOT / ".env")

DEFAULT_PORT = int(os.environ.get("PORT", "8788"))
MAX_STATE_BYTES = 2 * 1024 * 1024
SESSION_COOKIE = "daily_compass_session"
SESSION_SECONDS = int(os.environ.get("DAILY_COMPASS_SESSION_SECONDS", "2592000"))
STATE_BACKUP_MIN_SECONDS = int(os.environ.get("DAILY_COMPASS_STATE_BACKUP_SECONDS", "3600"))


def configured_path(env_name: str, fallback: Path) -> Path:
    raw = os.environ.get(env_name)
    if not raw:
        return fallback
    path = Path(raw).expanduser()
    if not path.is_absolute():
        path = ROOT / path
    return path


LOG_FILE = configured_path("DAILY_COMPASS_LOG_FILE", ROOT / "server.log")
STATE_FILE = configured_path("DAILY_COMPASS_STATE_FILE", ROOT / "app-state.json")
STATE_BACKUP_DIR = configured_path("DAILY_COMPASS_STATE_BACKUP_DIR", STATE_FILE.parent / "state-backups")
PUBLIC_STATIC_PATHS = {
    "/",
    "/index.html",
    "/styles.css",
    "/app.js",
    "/quest-rules.js",
    "/favicon.ico",
    "/apple-touch-icon.png",
    "/apple-touch-icon-precomposed.png",
    "/apple-touch-icon-120x120.png",
    "/apple-touch-icon-120x120-precomposed.png",
}
LOGIN_FAILURES: dict[str, list[float]] = {}
LOGIN_ATTEMPT_WINDOW_SECONDS = 10 * 60
LOGIN_ATTEMPT_LIMIT = 8


class AppHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_GET(self):
        path = self.path.split("?", 1)[0]
        if path == "/healthz":
            self.send_json(200, {"ok": True})
            return
        if cloud_auth_missing():
            self.send_json(503, {
                "ok": False,
                "error": "cloud authentication is not configured",
            })
            return
        if path == "/login":
            self.send_login_page()
            return
        if path == "/api/session":
            self.send_json(200, {
                "authRequired": auth_enabled(),
                "authenticated": self.is_authenticated(),
            })
            return
        if not self.require_auth(path):
            return
        if path == "/api/state":
            self.send_state()
            return
        if not is_public_static_path(path):
            self.send_error(404)
            return
        super().do_GET()

    def do_POST(self):
        path = self.path.split("?", 1)[0]
        if cloud_auth_missing():
            self.send_json(503, {
                "ok": False,
                "error": "cloud authentication is not configured",
            })
            return
        if path == "/login":
            self.handle_login()
            return
        if path == "/logout":
            self.handle_logout()
            return
        if not self.require_auth(path):
            return
        if path == "/api/state":
            self.save_state()
            return
        self.send_error(404)

    def require_auth(self, path: str) -> bool:
        if self.is_authenticated():
            return True
        if path.startswith("/api/"):
            self.send_json(401, {"ok": False, "error": "authentication required"})
            return False
        self.redirect("/login")
        return False

    def is_authenticated(self) -> bool:
        if not auth_enabled():
            return True
        token = self.cookie_value(SESSION_COOKIE)
        return bool(token and valid_session_token(token))

    def cookie_value(self, name: str) -> str | None:
        cookie = SimpleCookie(self.headers.get("Cookie", ""))
        if name not in cookie:
            return None
        return cookie[name].value

    def handle_login(self) -> None:
        client_key = self.client_address[0]
        if login_is_rate_limited(client_key):
            self.send_login_page("ログイン試行が多すぎます。少し時間を置いてください。", status=429)
            return
        length = min(int(self.headers.get("Content-Length", "0") or "0"), 4096)
        form = parse_qs(self.rfile.read(length).decode("utf-8", errors="replace"))
        password = form.get("password", [""])[0]
        if password_matches(password):
            clear_login_failures(client_key)
            self.send_response(303)
            self.send_header("Location", "/")
            self.send_header("Set-Cookie", self.session_cookie_header(create_session_token()))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            return
        record_login_failure(client_key)
        self.send_login_page("パスワードが違います。", status=401)

    def handle_logout(self) -> None:
        self.send_response(303)
        self.send_header("Location", "/login")
        self.send_header("Set-Cookie", f"{SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()

    def session_cookie_header(self, token: str) -> str:
        cookie = f"{SESSION_COOKIE}={token}; Path=/; Max-Age={SESSION_SECONDS}; HttpOnly; SameSite=Lax"
        if should_use_secure_cookie(self):
            cookie += "; Secure"
        return cookie

    def send_login_page(self, error: str = "", status: int = 200) -> None:
        if self.is_authenticated():
            self.redirect("/")
            return
        error_html = f"<p class=\"error\">{escape_html(error)}</p>" if error else ""
        body = f"""<!doctype html>
<html lang="ja">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Daily Compass Login</title>
    <style>
      * {{ box-sizing: border-box; }}
      body {{
        min-height: 100vh;
        margin: 0;
        display: grid;
        place-items: center;
        background: #eef3f1;
        color: #1a2230;
        font-family: "Yu Gothic UI", "Meiryo", system-ui, sans-serif;
      }}
      main {{
        width: min(420px, calc(100% - 32px));
        border: 1px solid #1a2230;
        border-radius: 8px;
        background: #fffdf6;
        box-shadow: 0 4px 0 rgba(112, 91, 50, 0.24), 0 18px 42px rgba(26, 34, 48, 0.12);
        padding: 24px;
      }}
      p {{ margin: 0 0 16px; color: #66707c; font-weight: 700; }}
      h1 {{ margin: 0 0 8px; font-size: 1.7rem; }}
      label {{ display: grid; gap: 8px; font-weight: 900; color: #66707c; }}
      input {{
        min-height: 44px;
        border: 1px solid #d9cba9;
        border-radius: 8px;
        padding: 0 12px;
        font: inherit;
      }}
      button {{
        width: 100%;
        min-height: 44px;
        margin-top: 16px;
        border: 1px solid #155a54;
        border-radius: 8px;
        background: #227c73;
        color: #fffdf6;
        font: inherit;
        font-weight: 900;
        cursor: pointer;
      }}
      .error {{ color: #b84b50; }}
    </style>
  </head>
  <body>
    <main>
      <h1>Daily Compass</h1>
      <p>個人用クラウド版です。パスワードを入力してください。</p>
      {error_html}
      <form method="post" action="/login">
        <label>
          パスワード
          <input name="password" type="password" autocomplete="current-password" required autofocus>
        </label>
        <button type="submit">ログイン</button>
      </form>
    </main>
  </body>
</html>
"""
        self.send_html(status, body)

    def end_headers(self) -> None:
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Referrer-Policy", "same-origin")
        self.send_header("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
        super().end_headers()

    def redirect(self, location: str) -> None:
        self.send_response(303)
        self.send_header("Location", location)
        self.send_header("Cache-Control", "no-store")
        self.end_headers()

    def send_json(self, status: int, payload: dict) -> None:
        body = json.dumps(payload, ensure_ascii=False, indent=2).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def send_html(self, status: int, html: str) -> None:
        body = html.encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def send_state(self) -> None:
        if not STATE_FILE.exists():
            self.send_json(200, {"version": 1, "savedAt": None, "state": None})
            return
        try:
            payload = json.loads(STATE_FILE.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            self.send_json(200, {"version": 1, "savedAt": None, "state": None})
            return
        self.send_json(200, payload)

    def save_state(self) -> None:
        length = int(self.headers.get("Content-Length", "0") or "0")
        if length <= 0 or length > MAX_STATE_BYTES:
            self.send_json(413, {"ok": False, "error": "state payload is too large"})
            return
        try:
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            self.send_json(400, {"ok": False, "error": "invalid json"})
            return
        if not isinstance(payload, dict) or not isinstance(payload.get("state"), dict):
            self.send_json(400, {"ok": False, "error": "invalid state"})
            return
        payload["version"] = 1
        payload["savedAt"] = datetime.now().isoformat(timespec="seconds")
        STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
        backup_state_file()
        tmp_file = STATE_FILE.with_suffix(".json.tmp")
        tmp_file.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        tmp_file.replace(STATE_FILE)
        self.send_json(200, {"ok": True, "savedAt": payload["savedAt"]})

    def log_message(self, fmt, *args):
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        message = fmt % args
        LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
        with LOG_FILE.open("a", encoding="utf-8") as log:
            log.write(f"[{timestamp}] {self.address_string()} {message}\n")


class AppServer(ThreadingHTTPServer):
    allow_reuse_address = True


def auth_enabled() -> bool:
    return bool(os.environ.get("DAILY_COMPASS_PASSWORD") or os.environ.get("DAILY_COMPASS_PASSWORD_HASH"))


def cloud_environment() -> bool:
    if os.environ.get("RENDER") == "true":
        return True
    if os.environ.get("RENDER_EXTERNAL_URL"):
        return True
    return os.environ.get("DAILY_COMPASS_FORCE_CLOUD_AUTH") == "1"


def cloud_auth_missing() -> bool:
    return cloud_environment() and not auth_enabled()


def password_matches(password: str) -> bool:
    plain = os.environ.get("DAILY_COMPASS_PASSWORD")
    if plain and hmac.compare_digest(password, plain):
        return True
    expected_hash = normalized_password_hash()
    if expected_hash:
        actual_hash = hashlib.sha256(password.encode("utf-8")).hexdigest()
        return hmac.compare_digest(actual_hash, expected_hash)
    return not auth_enabled()


def normalized_password_hash() -> str:
    raw = os.environ.get("DAILY_COMPASS_PASSWORD_HASH", "").strip().lower()
    if raw.startswith("sha256:"):
        return raw.split(":", 1)[1]
    return raw


def create_session_token() -> str:
    expires = int(time.time()) + SESSION_SECONDS
    nonce = secrets.token_urlsafe(18)
    payload = f"{expires}:{nonce}"
    signature = sign(payload)
    return f"{payload}:{signature}"


def valid_session_token(token: str) -> bool:
    parts = token.split(":")
    if len(parts) != 3:
        return False
    expires_raw, nonce, signature = parts
    if not expires_raw.isdigit() or int(expires_raw) < int(time.time()):
        return False
    payload = f"{expires_raw}:{nonce}"
    return hmac.compare_digest(signature, sign(payload))


def sign(payload: str) -> str:
    secret = os.environ.get("DAILY_COMPASS_SECRET")
    if not secret:
        secret = os.environ.get("DAILY_COMPASS_PASSWORD") or os.environ.get("DAILY_COMPASS_PASSWORD_HASH") or "daily-compass-local-dev"
    return hmac.new(secret.encode("utf-8"), payload.encode("utf-8"), hashlib.sha256).hexdigest()


def should_use_secure_cookie(handler: AppHandler) -> bool:
    if os.environ.get("DAILY_COMPASS_COOKIE_SECURE") == "1":
        return True
    return handler.headers.get("X-Forwarded-Proto", "").lower() == "https"


def is_public_static_path(path: str) -> bool:
    decoded = unquote(path)
    if decoded in PUBLIC_STATIC_PATHS:
        return True
    return False


def login_is_rate_limited(client_key: str) -> bool:
    prune_login_failures(client_key)
    return len(LOGIN_FAILURES.get(client_key, [])) >= LOGIN_ATTEMPT_LIMIT


def record_login_failure(client_key: str) -> None:
    prune_login_failures(client_key)
    LOGIN_FAILURES.setdefault(client_key, []).append(time.time())


def clear_login_failures(client_key: str) -> None:
    LOGIN_FAILURES.pop(client_key, None)


def prune_login_failures(client_key: str) -> None:
    cutoff = time.time() - LOGIN_ATTEMPT_WINDOW_SECONDS
    LOGIN_FAILURES[client_key] = [
        timestamp for timestamp in LOGIN_FAILURES.get(client_key, [])
        if timestamp >= cutoff
    ]
    if not LOGIN_FAILURES[client_key]:
        LOGIN_FAILURES.pop(client_key, None)


def backup_state_file() -> None:
    if not STATE_FILE.exists():
        return
    latest = latest_state_backup()
    if latest and time.time() - latest.stat().st_mtime < STATE_BACKUP_MIN_SECONDS:
        return
    STATE_BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    backup_file = STATE_BACKUP_DIR / f"app-state-{stamp}.json"
    backup_file.write_bytes(STATE_FILE.read_bytes())


def latest_state_backup() -> Path | None:
    if not STATE_BACKUP_DIR.exists():
        return None
    backups = list(STATE_BACKUP_DIR.glob("app-state-*.json"))
    if not backups:
        return None
    return max(backups, key=lambda path: path.stat().st_mtime)


def escape_html(value: str) -> str:
    return (
        value.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
        .replace("'", "&#039;")
    )


def get_lan_ip() -> str | None:
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
            sock.connect(("8.8.8.8", 80))
            return sock.getsockname()[0]
    except OSError:
        pass

    try:
        for ip_address in socket.gethostbyname_ex(socket.gethostname())[2]:
            if not ip_address.startswith("127."):
                return ip_address
    except OSError:
        pass

    return None


def print_urls(host: str, port: int) -> None:
    safe_print(f"Serving: {ROOT}")
    safe_print(f"State:   {STATE_FILE}")
    safe_print(f"Auth:    {'enabled' if auth_enabled() else 'disabled'}")
    if cloud_auth_missing():
        safe_print("Cloud guard: password is required before this app can be used from a public URL.")
    safe_print(f"Local:   http://127.0.0.1:{port}/")

    public_url = os.environ.get("RENDER_EXTERNAL_URL") or os.environ.get("DAILY_COMPASS_PUBLIC_URL")
    if public_url:
        safe_print(f"Cloud:   {public_url}")

    if host in {"0.0.0.0", ""}:
        lan_ip = get_lan_ip()
        if lan_ip:
            safe_print(f"Phone:   http://{lan_ip}:{port}/")
            safe_print("Open the Phone URL on a device connected to the same Wi-Fi/LAN.")
        else:
            safe_print("Phone:   Could not detect LAN IP. Run ipconfig and use the IPv4 address.")
        return

    if not host.startswith("127.") and host != "localhost":
        safe_print(f"Phone:   http://{host}:{port}/")


def safe_print(message: str) -> None:
    try:
        print(message, flush=True)
    except (AttributeError, OSError, ValueError):
        pass


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=DEFAULT_PORT)
    parser.add_argument(
        "--host",
        default=DEFAULT_HOST,
        help="Host/interface to bind. Use 0.0.0.0 for phone/LAN access.",
    )
    args = parser.parse_args()

    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
    server = AppServer((args.host, args.port), AppHandler)
    print_urls(args.host, args.port)
    try:
        server.serve_forever()
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
