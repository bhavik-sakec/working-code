# Sentinel's Security Journal

## 2026-02-13 - Unsanitized User Input in File Generation

**Vulnerability:** Found a Reflected File Download / XSS risk where user-provided `timestamp` was directly used to construct filenames returned in JSON responses without validation.
**Learning:** Developers often trust parameters that seem benign (like "timestamp") assuming they will be valid dates, but attackers can use them for injection.
**Prevention:** Always validate all user inputs against a strict whitelist (e.g. alphanumeric only), especially when used in output generation or file operations.
