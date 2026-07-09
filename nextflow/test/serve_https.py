#!/usr/bin/env python3
"""Serve a directory over HTTPS with CORS headers for local Samui testing.

The Samui browser at https://samuibrowser.com forces https:// on the data host
and runs cross-origin, so a sample folder must be served over HTTPS with a CORS
policy that allows the Samui origin. This is a test helper only.

Usage:
  python test/serve_https.py --root /path/to/outdir --port 8443 \
      --cert test/certs/cert.pem --key test/certs/key.pem

Then in Chrome accept the self-signed cert once by visiting
https://localhost:8443/ and proceeding past the warning, and open:
  https://samuibrowser.com/from?url=localhost:8443&s=<SAMPLE_NAME>
"""
import argparse
import os
import re
import ssl
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class CORSHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "*")
        # Samui is served from a public origin (samuibrowser.com) but this server is
        # on localhost (a private address). Chrome's Private Network Access policy
        # blocks public->private requests unless the preflight grants it explicitly.
        self.send_header("Access-Control-Allow-Private-Network", "true")
        # Let the browser read length/range headers so the COG tile reader works.
        self.send_header("Access-Control-Expose-Headers", "Content-Length, Content-Range, Accept-Ranges")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def do_GET(self):
        # Serve byte ranges (206) when asked. The stdlib handler ignores Range and
        # returns the whole file with 200, which makes geotiff.js re-download the
        # entire COG per tile request and stall on large images.
        m = re.match(r"bytes=(\d+)-(\d*)\s*$", self.headers.get("Range", ""))
        path = self.translate_path(self.path)
        if not m or not os.path.isfile(path):
            return super().do_GET()

        size = os.path.getsize(path)
        start = int(m.group(1))
        end = int(m.group(2)) if m.group(2) else size - 1
        end = min(end, size - 1)
        if start > end:
            self.send_response(416)
            self.send_header("Content-Range", f"bytes */{size}")
            self.end_headers()
            return

        self.send_response(206)
        self.send_header("Content-Type", self.guess_type(path))
        self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        self.send_header("Content-Length", str(end - start + 1))
        self.send_header("Accept-Ranges", "bytes")
        self.end_headers()
        with open(path, "rb") as f:
            f.seek(start)
            remaining = end - start + 1
            while remaining > 0:
                chunk = f.read(min(65536, remaining))
                if not chunk:
                    break
                self.wfile.write(chunk)
                remaining -= len(chunk)


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--root", required=True)
    p.add_argument("--port", type=int, default=8443)
    p.add_argument("--cert", default="test/certs/cert.pem")
    p.add_argument("--key", default="test/certs/key.pem")
    args = p.parse_args()

    ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    ctx.load_cert_chain(certfile=args.cert, keyfile=args.key)

    httpd = ThreadingHTTPServer(("127.0.0.1", args.port), partial(CORSHandler, directory=args.root))
    httpd.socket = ctx.wrap_socket(httpd.socket, server_side=True)
    print(f"Serving {args.root} at https://localhost:{args.port}/")
    httpd.serve_forever()


if __name__ == "__main__":
    main()
