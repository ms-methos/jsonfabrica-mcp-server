# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.2] - 2026-10-06

### Fixed

- MCP `serverInfo.version` reported at `initialize` is now read from
  package.json instead of a hardcoded `0.1.0`, so clients see the real
  package version.

## [0.3.1] - 2026-10-05

### Fixed

- Batch tools' outputSchema now matches the real API response (results grouped
  by alias). `jsonfabrica_create_batch` no longer fails with "Output validation
  error" on synchronous batches, and `jsonfabrica_get_batch` no longer
  advertises fields the API never returns (`tenantId`, `spec`, `documents[]`).

## [0.3.0] - 2026-09-09

### Removed

- `jsonfabrica_list_function_weights` and `jsonfabrica_update_function_weight` —
  admin-only endpoints unusable with public (role=user) API keys.

## [0.2.0]

- Prior release. See git history for details.
