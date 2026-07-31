#!/usr/bin/env python3
"""Static dev server with live reload. Not deployed - GitHub Pages ignores it.

Serves the site and injects an SSE client into index.html that reloads the tab
whenever an html/css/js file changes.
"""
import io
import os
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

PORT = 8000
WATCHED = ('.html', '.css', '.js')
CLIENT = b"<script>new EventSource('/__reload').onmessage=()=>location.reload()</script>"


def newest_mtime():
    latest = 0.0
    for root, dirs, files in os.walk('.'):
        dirs[:] = [d for d in dirs if not d.startswith('.')]
        for name in files:
            if name.endswith(WATCHED):
                latest = max(latest, os.path.getmtime(os.path.join(root, name)))
    return latest


class Handler(SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/__reload':
            return self.stream_reloads()
        super().do_GET()

    def stream_reloads(self):
        self.send_response(200)
        self.send_header('Content-Type', 'text/event-stream')
        self.send_header('Cache-Control', 'no-cache')
        self.end_headers()
        seen = newest_mtime()
        try:
            while True:
                time.sleep(0.3)
                current = newest_mtime()
                if current > seen:
                    seen = current
                    self.wfile.write(b'data: reload\n\n')
                    self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError):
            pass

    def send_head(self):
        path = self.translate_path(self.path)
        if os.path.isdir(path):
            path = os.path.join(path, 'index.html')
        if not path.endswith('.html') or not os.path.isfile(path):
            return super().send_head()

        with open(path, 'rb') as f:
            body = f.read().replace(b'</body>', CLIENT + b'</body>')
        self.send_response(200)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        return io.BytesIO(body)

    def end_headers(self):
        if self.path != '/__reload':
            self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def log_message(self, *args):
        pass


if __name__ == '__main__':
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    print(f'http://localhost:{PORT}  (live reload on)')
    ThreadingHTTPServer(('', PORT), Handler).serve_forever()
