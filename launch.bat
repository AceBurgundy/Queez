@echo off
cd /d "%~dp0"
python -c "import http.server, socketserver, webbrowser; s=socketserver.TCPServer(('127.0.0.1', 0), http.server.SimpleHTTPRequestHandler); p=s.server_address[1]; webbrowser.open(f'http://localhost:{p}'); print('='*50); print(f' Queez! running at: http://localhost:{p}'); print(' Press Ctrl+C to close.'); print('='*50); s.serve_forever()"


