# Security Policy

## Supported Versions

TurboGrab is under active development. Security fixes are applied to the latest
release line only.

| Version | Supported |
|---------|-----------|
| 1.0.x   | ✅        |

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

Use GitHub's **private vulnerability reporting** instead:

1. Go to the [TurboGrab repository](https://github.com/Aryan-lakhotia99/TurboGrab)
2. Open the **Security** tab
3. Click **Report a vulnerability**

This notifies the maintainers privately and keeps the issue tracking coordinated.
Please include:

- The type of issue (e.g., remote code execution, privilege escalation, data exposure)
- Full paths of the source files involved and the location of the affected code
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if possible)
- Impact assessment, including how an attacker might exploit the issue

You should receive a response within 72 hours. If you do not, please follow up
once via the same channel.

## Scope

In scope:

- The Electron desktop app (`electron/`)
- The browser extension (`extension/`)
- The local WebSocket / HTTP bridge (`127.0.0.1:48123`)
- The SQLite persistence layer and downloaded file handling
- CI workflows and the repository supply chain

Out of scope:

- Vulnerabilities in dependencies that are already publicly disclosed and have
  patched versions available (report via Dependabot alerts instead)
- Social engineering, phishing, or physical attacks
- Denial-of-service via filling the user's own disk with user-initiated downloads

## Disclosure Timeline

1. Report received and acknowledged (within 72 hours)
2. Triage, severity assessment, and fix development
3. Coordinated public disclosure via a GitHub Security Advisory and a patch
   release once a fix is available

Thank you for helping keep TurboGrab and its users safe. 🙏
