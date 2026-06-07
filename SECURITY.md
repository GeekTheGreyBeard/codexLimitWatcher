# Security Policy

## Credential Handling

Codex Limit Watcher stores ChatGPT OAuth tokens only in the app user-data directory. On Unix-like systems the credential file is written with `0600` permissions.

Do not include OAuth tokens, callback codes, or local auth files in bug reports. Redact account identifiers if they are not needed for diagnosis.

## Reporting

For now, report security issues privately to the repository owner before publishing details.
