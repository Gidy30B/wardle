# WEOS Governance Decisions

This directory contains Stage 1 contract evidence for `WEOS-OD-018`. It does not contain operational Governance Decision records and does not create production authority.

## Stage 1 Boundary

- `governance-decision-envelope.schema.json` describes the common immutable envelope shape.
- `governance-decision-extension-registry.schema.json` describes how domain-specific extension policies are registered.
- `extension-registry.json` is intentionally empty of approved production extensions.

Only registered approved extensions may validate a Governance Decision. Unregistered extensions cannot establish a valid decision. `WEOS-OD-021` document-authority records remain canonical for document authority and are not converted into Governance Decision records by this directory.

Runtime enforcement, Prisma schema work, persistence, API routes, command handlers, projection synchronization and production rollout remain unauthorized.
