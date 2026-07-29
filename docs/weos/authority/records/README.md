# WEOS Authority Records

This directory contains repository-native authority records for WEOS document approval, supersession and protected-field exceptions.

Authority is established only by valid records that match the schemas in `docs/weos/authority/schemas/`. File existence is not approval. Missing or invalid records mean authority remains unresolved for the affected document, version and scope.

Stage 1 records are version-controlled JSON evidence. They do not create Prisma models, database state, runtime enforcement, API behavior, route permissions or production rollout authority.
