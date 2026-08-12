# Game Agent Instructions

## Learner Runtime Rules

1. Learner behavior must remain deterministic.
2. Learner exposure semantics must come from backend contracts.
3. Do not duplicate editorial governance rules into the learner client.
4. Completed attempt history must not be silently rewritten.
5. Do not change gameplay correctness, published case visibility, or attempt
   scoring semantics without an explicit approved runtime work package.

## WEOS Boundary

The game client consumes governed backend outputs. It is not the source of
editorial approval, publication authority, learner exposure authority, or
governance history.
