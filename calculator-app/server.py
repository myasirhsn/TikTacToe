#!/usr/bin/env python3
# How to run: python3 server.py  (default port 8000)

import json
import re
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

MAX_EXPRESSION_LENGTH = 200

_SAFE_TOKEN_RE = re.compile(
    r"""
    \s+          # whitespace
    | \d+\.\d+   # decimal number
    | \d+        # integer number
    | [+*/\-()]  # operators and parentheses
    """,
    re.VERBOSE,
)


class ExpressionParseError(ValueError):
    """Raised when an expression cannot be parsed or evaluated safely."""


class ExpressionParser:
    """Small safe recursive-descent parser for arithmetic expressions.

    Supports + - * /, parentheses, integer and decimal numbers.
    Never uses dynamic code evaluation.
    """

    def __init__(self, tokens):
        self.tokens = tokens
        self.pos = 0

    def peek(self):
        return self.tokens[self.pos] if self.pos < len(self.tokens) else None

    def advance(self):
        token = self.peek()
        self.pos += 1
        return token

    def parse(self):
        value = self.parse_expression()
        if self.peek() is not None:
            raise ExpressionParseError("malformed expression")
        return value

    def parse_expression(self):
        value = self.parse_term()
        while True:
            op = self.peek()
            if op in ("+", "-"):
                self.advance()
                right = self.parse_term()
                if op == "+":
                    value = value + right
                else:
                    value = value - right
            else:
                return value

    def parse_term(self):
        value = self.parse_factor()
        while True:
            op = self.peek()
            if op in ("*", "/"):
                self.advance()
                right = self.parse_factor()
                if op == "*":
                    value = value * right
                else:
                    if right == 0:
                        raise ExpressionParseError("division by zero")
                    value = value / right
            else:
                return value

    def parse_factor(self):
        token = self.peek()
        if token is None:
            raise ExpressionParseError("malformed expression")
        if token == "(":
            self.advance()
            value = self.parse_expression()
            if self.advance() != ")":
                raise ExpressionParseError("unbalanced parentheses")
            return value
        if token.isdigit() or token.count(".") == 1 and token.replace(".", "").isdigit():
            self.advance()
            return float(token) if token.count(".") == 1 else int(token)
        raise ExpressionParseError("malformed expression")


def tokenize(expression):
    if not expression or not expression.strip():
        raise ExpressionParseError("empty expression")
    if len(expression) > MAX_EXPRESSION_LENGTH:
        raise ExpressionParseError(
            "expression too long (max %d characters)" % MAX_EXPRESSION_LENGTH
        )
    tokens = []
    pos = 0
    while pos < len(expression):
        match = _SAFE_TOKEN_RE.match(expression, pos)
        if match is None or match.end() == pos:
            raise ExpressionParseError(
                "invalid character %r" % expression[pos]
            )
        token = match.group(0).strip()
        if token:
            tokens.append(token)
        pos = match.end()
    return tokens


def evaluate(expression):
    """Evaluate a safe arithmetic expression, returning an int or float result."""
    tokens = tokenize(expression)
    if not tokens:
        raise ExpressionParseError("empty expression")
    return ExpressionParser(tokens).parse()


def normalize_result(value):
    if isinstance(value, float) and value.is_integer():
        return int(value)
    return value


class CalculatorHandler(BaseHTTPRequestHandler):
    server_version = "CalculatorServer/1.0"

    def _send_json(self, status, payload):
        body = json.dumps(payload)
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body.encode("utf-8"))

    def do_GET(self):
        if self.path in ("/", "/index.html"):
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            try:
                with open("index.html", "rb") as fh:
                    body = fh.read()
            except OSError:
                self.send_header("Content-Length", "0")
                self.end_headers()
                return
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        else:
            self._send_json(404, {"error": "not found"})

    def do_POST(self):
        if self.path != "/calculate":
            self._send_json(404, {"error": "not found"})
            return
        try:
            content_length = int(self.headers.get("Content-Length", 0))
        except (TypeError, ValueError):
            content_length = 0
        try:
            raw = self.rfile.read(content_length) if content_length > 0 else b""
            payload = json.loads(raw.decode("utf-8"))
            expression = payload["expression"]
        except Exception:
            self._send_json(400, {"error": "invalid JSON body: expected {\"expression\": \"...\"}"})
            return
        if not isinstance(expression, str):
            self._send_json(400, {"error": "expression must be a string"})
            return
        try:
            result = evaluate(expression)
        except ExpressionParseError as exc:
            self._send_json(400, {"error": str(exc)})
            return
        self._send_json(200, {"result": normalize_result(result)})

    def log_message(self, fmt, *args):
        # Suppress default per-request logging noise; keep server output clean.
        pass


def main():
    port = 8000
    server = ThreadingHTTPServer(("0.0.0.0", port), CalculatorHandler)
    print("Serving calculator server on http://0.0.0.0:%d" % port)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()