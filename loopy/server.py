from __future__ import annotations

import ipaddress
import shutil
import subprocess
import time
import webbrowser
from dataclasses import dataclass
from pathlib import Path
from threading import Thread
from typing import Callable, Iterable, Literal, Optional
from urllib.parse import quote

from loopy.logger import log


def serve_directory_fastapi(
    directory: Path,
    host: str = "127.0.0.1",
    port: int = 8000,
    open_browser: bool = True,
    *,
    ssl_certfile: Optional[str] = None,
    ssl_keyfile: Optional[str] = None,
    max_port_tries: int = 20,
    public_host: Optional[str] = None,
) -> None:
    """Serve files using FastAPI + Uvicorn if available.

    Raises ImportError if fastapi/uvicorn is not installed.
    """
    directory = directory.resolve()
    if not directory.exists() or not directory.is_dir():
        raise ValueError(f"Directory does not exist: {directory}")

    try:
        import uvicorn
        from fastapi import FastAPI
        from fastapi.middleware.cors import CORSMiddleware
        from fastapi.staticfiles import StaticFiles
        from starlette.responses import RedirectResponse
    except Exception as e:  # noqa: BLE001
        raise ImportError(
            "FastAPI/Uvicorn not available. Install with `pip install fastapi uvicorn` or `uv add fastapi uvicorn`."
        ) from e

    app = FastAPI()

    # Build Samui link by scanning for sample.json in immediate subdirectories
    def _collect_samples(dir_path: Path) -> list[str]:
        try:
            return sorted([p.name for p in dir_path.iterdir() if p.is_dir() and (p / "sample.json").exists()])
        except Exception:
            return []

    # Determine static root and samples
    if (directory / "sample.json").exists():
        static_root = directory.parent
        samples = [directory.name]
    else:
        static_root = directory
        samples = _collect_samples(static_root)

    # Hardcoded CORS for Samui domains
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["https://samuibrowser.com", "https://dev.samuibrowser.com"],
        allow_credentials=False,
        allow_methods=["GET", "HEAD", "OPTIONS"],
        allow_headers=["*"],
        max_age=3000,
    )

    # Mount static
    app.mount("/", StaticFiles(directory=str(static_root), html=True), name="static")

    # Build redirect link per-request to ensure correct host:port
    def _samui_link_for_netloc(netloc: str) -> str:
        # Respect public_host override (replace host, keep port)
        if public_host and ":" in netloc:
            _, portpart = netloc.split(":", 1)
            base = f"{public_host}:{portpart}"
        else:
            base = public_host or netloc
        if samples:
            s_params = "&".join(f"s={quote(n, safe='')}" for n in samples)
            return f"https://samuibrowser.com/from?url={quote(base, safe='')}&{s_params}"
        return f"https://samuibrowser.com/from?url={quote(base, safe='')}"

    @app.middleware("http")
    async def _root_redirect(request, call_next):  # type: ignore[no-redef]
        if request.url.path == "/" and request.method in {"GET", "HEAD"}:
            return RedirectResponse(url=_samui_link_for_netloc(request.url.netloc), status_code=307)
        return await call_next(request)

    # Port fallback loop
    last_err: Optional[BaseException] = None
    for i in range(max_port_tries):
        try_port = port + i
        scheme = "https" if ssl_certfile and ssl_keyfile else "http"
        url = f"{scheme}://{host}:{try_port}/"

        log("Serving", static_root, "at", url)
        log("Open in Samui:", _samui_link_for_netloc(f"{host}:{try_port}"))

        if open_browser:

            def _open() -> None:
                try:
                    webbrowser.open(url)
                except Exception as e:  # pragma: no cover
                    log("Failed to open browser:", e, type_="WARNING")

            Thread(target=_open, daemon=True).start()

        try:
            uvicorn.run(
                app,
                host=host,
                port=try_port,
                log_level="info",
                ssl_certfile=ssl_certfile,
                ssl_keyfile=ssl_keyfile,
            )
            log("Stopped serving:", url)
            return
        except OSError as e:
            # EADDRINUSE: 98 (Linux), 48 (macOS), 10048 (Windows)
            if getattr(e, "errno", None) in (98, 48, 10048):
                log(f"Port {try_port} in use; trying {try_port + 1}.", type_="WARNING")
                last_err = e
                continue
            raise
        except Exception as e:
            last_err = e
            break

    if last_err:
        raise last_err


def prefer_fastapi_available() -> bool:
    try:
        import fastapi  # noqa: F401
        import uvicorn  # noqa: F401

        return True
    except Exception:
        return False


@dataclass
class ServerHandle:
    """Handle for a background HTTP server.

    Use `stop()` to terminate. Supports context manager usage.
    """

    url: str
    backend: Literal["fastapi"]
    _stopper: Callable[[], None]
    _thread: Thread

    def stop(self) -> None:
        self._stopper()

    def is_alive(self) -> bool:
        return self._thread.is_alive()

    def __enter__(self) -> "ServerHandle":  # pragma: no cover - convenience
        return self

    def __exit__(self, exc_type, exc, tb) -> None:  # pragma: no cover - convenience
        self.stop()


def _start_fastapi_server(
    directory: Path,
    host: str,
    port: int,
    *,
    ssl_certfile: Optional[str] = None,
    ssl_keyfile: Optional[str] = None,
    public_host: Optional[str] = None,
) -> ServerHandle:
    import uvicorn
    from fastapi import FastAPI
    from fastapi.middleware.cors import CORSMiddleware
    from fastapi.staticfiles import StaticFiles
    from starlette.responses import RedirectResponse

    app = FastAPI()

    def _collect_samples(dir_path: Path) -> list[str]:
        try:
            return sorted([p.name for p in dir_path.iterdir() if p.is_dir() and (p / "sample.json").exists()])
        except Exception:
            return []

    # Determine static root and samples
    if (directory / "sample.json").exists():
        static_root = directory.parent
        samples = [directory.name]
    else:
        static_root = directory
        samples = _collect_samples(static_root)

    def _samui_link_for_netloc(netloc: str) -> str:
        if public_host and ":" in netloc:
            _, portpart = netloc.split(":", 1)
            base = f"{public_host}:{portpart}"
        else:
            base = public_host or netloc
        if samples:
            s_params = "&".join(f"s={quote(n, safe='')}" for n in samples)
            return f"https://samuibrowser.com/from?url={quote(base, safe='')}&{s_params}"
        return f"https://samuibrowser.com/from?url={quote(base, safe='')}"

    @app.middleware("http")
    async def _root_redirect(request, call_next):  # type: ignore[no-redef]
        if request.url.path == "/" and request.method in {"GET", "HEAD"}:
            return RedirectResponse(url=_samui_link_for_netloc(request.url.netloc), status_code=307)
        return await call_next(request)

    app.mount("/", StaticFiles(directory=str(static_root), html=True), name="static")
    # Hardcoded CORS for Samui domains
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["https://samuibrowser.com", "https://dev.samuibrowser.com"],
        allow_credentials=False,
        allow_methods=["GET", "HEAD", "OPTIONS"],
        allow_headers=["*"],
        max_age=3000,
    )

    # Try to find an open port by attempting up to max tries
    selected_port = port
    for i in range(20):
        try_port = port + i
        try:
            config = uvicorn.Config(
                app,
                host=host,
                port=try_port,
                log_level="info",
                ssl_certfile=ssl_certfile,
                ssl_keyfile=ssl_keyfile,
            )
            server = uvicorn.Server(config)
            selected_port = try_port
            break
        except OSError as e:
            if getattr(e, "errno", None) in (98, 48, 10048):
                continue
            raise
    scheme = "https" if ssl_certfile and ssl_keyfile else "http"
    url = f"{scheme}://{host}:{selected_port}/"
    # Build link using selected port

    def _run() -> None:
        # Running inside a thread; rely on should_exit for shutdown.
        server.run()

    thread = Thread(target=_run, daemon=True)
    thread.start()
    log("Serving", static_root, "at", url)
    log("Open in Samui:", _samui_link_for_netloc(f"{host}:{selected_port}"))

    def _stop() -> None:
        server.should_exit = True
        thread.join(timeout=3)
        log("Server stopped.")

    return ServerHandle(url=url, backend="fastapi", _stopper=_stop, _thread=thread)


def serve_directory(
    directory: Path | str,
    *,
    host: str = "127.0.0.1",
    port: int = 8000,
    open_browser: bool = True,
    block: bool = True,
    ssl_certfile: Optional[str] = None,
    ssl_keyfile: Optional[str] = None,
    public_host: Optional[str] = None,
) -> Optional[ServerHandle]:
    """Serve `directory` over HTTP as a library function.

    - When `backend='auto'`, uses FastAPI+Uvicorn if available, else stdlib.
    - If `block=True` (default), runs until interrupted and returns `None`.
      If `block=False`, returns a `ServerHandle` you can stop later.

    Example:
        >>> from loopy.server import serve_directory
        >>> serve_directory("./loopy/sample", backend="auto")  # blocks
    """
    directory = Path(directory).resolve()
    if not directory.exists() or not directory.is_dir():
        raise ValueError(f"Directory does not exist: {directory}")

    if block:
        try:
            serve_directory_fastapi(
                directory,
                host=host,
                port=port,
                open_browser=open_browser,
                ssl_certfile=ssl_certfile,
                ssl_keyfile=ssl_keyfile,
                public_host=public_host,
            )
        except ImportError:
            raise ImportError("FastAPI/Uvicorn not available. Install extras with `pip install loopy-browser[server]`.")
        return None
    else:
        try:
            return _start_fastapi_server(
                directory,
                host,
                port,
                ssl_certfile=ssl_certfile,
                ssl_keyfile=ssl_keyfile,
                public_host=public_host,
            )
        except ImportError:
            raise ImportError("FastAPI/Uvicorn not available. Install extras with `pip install loopy-browser[server]`.")


def detect_client_host(bind_host: str) -> str:
    if bind_host not in ("0.0.0.0", "::"):
        return bind_host
    try:
        import socket

        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("8.8.8.8", 80))
            return s.getsockname()[0]
    except Exception:
        try:
            import socket as _s

            return _s.gethostbyname(_s.gethostname())
        except Exception:
            return "127.0.0.1"


def serve_samui(
    directory: Path | str,
    *,
    host: str = "127.0.0.1",
    port: int = 8000,
    open_browser: bool = True,
    block: bool = True,
) -> Optional[ServerHandle]:
    directory = Path(directory).resolve()
    client_host = detect_client_host(host)
    cert, key = get_or_create_self_signed(str(host), alt_hosts=[client_host] if client_host else None)
    scheme = "https"
    bound_url = f"{scheme}://{host}:{port}/"
    log("URL (bound):", bound_url)
    if client_host != host:
        log("Client URL:", f"{scheme}://{client_host}:{port}/")
    return serve_directory(
        directory,
        host=host,
        port=port,
        open_browser=open_browser,
        block=block,
        ssl_certfile=cert,
        ssl_keyfile=key,
        public_host=client_host,
    )


def get_or_create_self_signed(
    host: str,
    *,
    days: int = 3650,
    alt_hosts: Optional[Iterable[str]] = None,
) -> tuple[str, str]:
    """Create or reuse a cached self-signed cert for `host`.

    - Caches under .loopy-ssl/<host>.cert.pem and .key.pem.
    - Returns (cert_path, key_path). Requires the `openssl` binary for first-time generation.
    """
    openssl = shutil.which("openssl")
    if not openssl:
        raise RuntimeError("OpenSSL not found. Cannot generate a self-signed certificate. Please install OpenSSL.")

    ssl_dir = Path.cwd() / ".loopy-ssl"
    ssl_dir.mkdir(parents=True, exist_ok=True)
    # Sanitize filename components
    safe_host = host.replace("/", "_").replace("\\", "_").replace(":", "_")
    cert_path = ssl_dir / f"{safe_host}.cert.pem"
    key_path = ssl_dir / f"{safe_host}.key.pem"
    conf_path = ssl_dir / f"openssl-{safe_host}.cnf"

    dns_idx = 1
    ip_idx = 1

    def add_dns(name: str) -> str:
        nonlocal dns_idx
        line = f"DNS.{dns_idx} = {name}"
        dns_idx += 1
        return line

    def add_ip(addr: str) -> str:
        nonlocal ip_idx
        line = f"IP.{ip_idx} = {addr}"
        ip_idx += 1
        return line

    alt_lines: list[str] = []
    try:
        ipaddress.ip_address(host)
        alt_lines.append(add_ip(host))
    except ValueError:
        alt_lines.append(add_dns(host))
    # Always include common loopback names
    alt_lines.append(add_dns("localhost"))
    alt_lines.append(add_ip("127.0.0.1"))
    # Include any provided alt hosts (IPs or DNS)
    if alt_hosts:
        for h in alt_hosts:
            try:
                ipaddress.ip_address(h)
                alt_lines.append(add_ip(h))
            except ValueError:
                alt_lines.append(add_dns(h))

    conf = (
        "[ req ]\n"
        "default_bits       = 2048\n"
        "distinguished_name = dn\n"
        "x509_extensions    = v3_req\n"
        "prompt             = no\n\n"
        "[ dn ]\n"
        f"CN = {host}\n\n"
        "[ v3_req ]\n"
        "subjectAltName = @alt_names\n"
        "basicConstraints = CA:FALSE\n"
        "keyUsage = digitalSignature, keyEncipherment\n"
        "extendedKeyUsage = serverAuth\n\n"
        "[ alt_names ]\n" + "\n".join(alt_lines) + "\n"
    )
    conf_path.write_text(conf)

    # Reuse if exists
    if cert_path.exists() and key_path.exists():
        log("Using cached TLS cert:", cert_path)
        return str(cert_path), str(key_path)

    # Generate new key+cert
    cmd = [
        openssl,
        "req",
        "-x509",
        "-newkey",
        "rsa:2048",
        "-sha256",
        "-days",
        str(days),
        "-nodes",
        "-keyout",
        str(key_path),
        "-out",
        str(cert_path),
        "-config",
        str(conf_path),
    ]
    try:
        subprocess.run(cmd, check=True, capture_output=True)
    except subprocess.CalledProcessError as e:
        raise RuntimeError(
            f"Failed to generate self-signed certificate for {host}: {e.stderr.decode(errors='ignore')}"
        ) from e
    log("Generated self-signed TLS cert:", cert_path)

    return str(cert_path), str(key_path)
