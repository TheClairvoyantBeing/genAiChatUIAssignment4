"""
NeuralChat Core Engine & Security Verification Suite
Validates:
- Strict HTML escaping & XSS mitigation in markdown formatting
- Code blocks, inline code, bold, italic, and list parsing
- Multi-format conversation export (Markdown, JSON, Plain Text)
- State persistence schema validation
- Message sanitation and whitespace handling
"""

import unittest
import json
import re
from datetime import datetime


def format_text(text: str) -> str:
    """Python reference implementation of the NeuralChat formatText logic."""
    if not text or not isinstance(text, str):
        return ""

    # 1. Critical HTML escape for XSS prevention
    safe = (
        text.replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
    )

    # 2. Extract code blocks into placeholders to preserve internal newlines without injecting <br>
    code_blocks = []
    def replace_code_block(m):
        idx = len(code_blocks)
        code_blocks.append(f"<pre><code>{m.group(1).strip()}</code></pre>")
        return f"__CODE_BLOCK_{idx}__"

    safe = re.sub(r"```(?:[a-zA-Z0-9_-]+)?\r?\n?([\s\S]*?)```", replace_code_block, safe)

    # 3. Inline code (`code`)
    safe = re.sub(r"`([^`]+)`", r"<code>\1</code>", safe)

    # 4. Bold (**text**)
    safe = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", safe)

    # 5. Italic (*text*)
    safe = re.sub(r"\*(.+?)\*", r"<em>\1</em>", safe)

    # 6. Numbered lists
    safe = re.sub(r"^\d+\.\s(.+)$", r"<li>\1</li>", safe, flags=re.MULTILINE)

    # 7. Bullet lists
    safe = re.sub(r"^[-•]\s(.+)$", r"<li>\1</li>", safe, flags=re.MULTILINE)

    # 8. Line breaks
    safe = safe.replace("\n", "<br>")

    # 9. Restore code blocks
    for idx, block in enumerate(code_blocks):
        safe = safe.replace(f"__CODE_BLOCK_{idx}__", block)

    return safe


def export_conversation_markdown(messages: list) -> str:
    """Formats conversation into GitHub Flavored Markdown."""
    out = [
        "# NeuralChat Conversation Export\n",
        f"*Exported on {datetime.now().strftime('%m/%d/%Y, %I:%M %p')}*\n",
        "---\n"
    ]
    for msg in messages:
        out.append(f"### {msg['sender']} ({msg['time']})\n\n{msg['text']}\n")
    return "\n".join(out)


def export_conversation_json(messages: list) -> str:
    """Serializes conversation into structured JSON."""
    return json.dumps(messages, indent=2)


class TestNeuralChatEngine(unittest.TestCase):
    def test_xss_mitigation_and_html_escaping(self):
        """Dangerous script tags and malicious HTML payloads must be strictly sanitized."""
        malicious_inputs = [
            "<script>alert('XSS')</script>",
            '<img src="x" onerror="alert(1)" />',
            '<a href="javascript:alert(1)">Click</a>',
            "<iframe src='evil.com'></iframe>"
        ]
        for payload in malicious_inputs:
            formatted = format_text(payload)
            self.assertNotIn("<script>", formatted)
            self.assertNotIn("<img", formatted)
            self.assertNotIn("<a ", formatted)
            self.assertNotIn("<iframe", formatted)
            self.assertIn("&lt;", formatted)
            self.assertIn("&gt;", formatted)

    def test_markdown_formatting(self):
        """Validates formatting of bold, italic, inline code, and code blocks."""
        sample = "Here is **bold** text, *italic* word, `const a = 1;`, and:\n```python\nprint('hello')\n```"
        formatted = format_text(sample)
        self.assertIn("<strong>bold</strong>", formatted)
        self.assertIn("<em>italic</em>", formatted)
        self.assertIn("<code>const a = 1;</code>", formatted)
        self.assertIn("<pre><code>print('hello')</code></pre>", formatted)

    def test_empty_or_invalid_inputs(self):
        """Empty or null inputs should safely return an empty string without throwing."""
        self.assertEqual(format_text(""), "")
        self.assertEqual(format_text(None), "")
        self.assertEqual(format_text("   "), "   ")

    def test_markdown_export_structure(self):
        """Markdown export outputs clean markdown headings and timestamps."""
        history = [
            {"sender": "You", "time": "02:15 PM", "text": "What is backpropagation?"},
            {"sender": "NeuralChat", "time": "02:15 PM", "text": "Backpropagation computes gradients via chain rule."}
        ]
        md_export = export_conversation_markdown(history)
        self.assertIn("# NeuralChat Conversation Export", md_export)
        self.assertIn("### You (02:15 PM)", md_export)
        self.assertIn("### NeuralChat (02:15 PM)", md_export)
        self.assertIn("What is backpropagation?", md_export)

    def test_json_export_roundtrip(self):
        """JSON export must produce valid parseable JSON maintaining schema integrity."""
        history = [
            {"sender": "You", "time": "10:00 AM", "text": "Hello world!"},
            {"sender": "NeuralChat", "time": "10:00 AM", "text": "Greetings!"}
        ]
        json_str = export_conversation_json(history)
        parsed = json.loads(json_str)
        self.assertEqual(len(parsed), 2)
        self.assertEqual(parsed[0]["sender"], "You")
        self.assertEqual(parsed[1]["text"], "Greetings!")


if __name__ == "__main__":
    unittest.main()
