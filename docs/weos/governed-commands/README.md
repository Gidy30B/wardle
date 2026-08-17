# WEOS Governed Commands

Stage 1 defines contract evidence only. These files are not DTOs, Prisma schema, runtime command handlers, services, persistence, token issuing, idempotency storage or production enforcement.

Authority and concurrency are independent requirements. A governed mutation must satisfy both an authority result and explicit expected-state policy before it can be eligible for future atomic application. Authority success does not bypass stale state, and current state does not bypass missing authority.

Exact revision is preferred for revisioned canonical artifacts. Mutable projection state is not a substitute for canonical revision identity where an exact reviewed revision exists. Opaque tokens are allowed only where an approved token policy binds the declared dependency set.

Command-contract registration is required, but registry presence alone does not approve a contract. Only approved definitions may establish eligibility. Command instance validation performs no mutation. Stale rejection creates no Governance Decision, mutation or projection update.

Idempotency does not bypass stale-state or authority checks. Governed batches are atomic by default. No automatic stale rebase is allowed; stale actors must refresh or rebase and issue a new command with new preconditions.

The production command-contract registry is empty. The production token-policy registry is empty. Test contracts and token policies exist only in test code. Legacy concurrency history remains unknown. Absence of a command contract proves neither safety nor previous failure. Runtime enforcement remains unauthorized.
