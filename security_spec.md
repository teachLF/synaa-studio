# Security Specification — سينا ستوديو (CineStudio 4K)

## 1. Data Invariants
1. **Strict Ownership**: Every document under `/users/{userId}/...` belongs exclusively to the authenticated and verified user (`request.auth.uid == userId && request.auth.token.email_verified == true`).
2. **PII Isolation**: Email, display name, and avatar URL live under `/users/{userId}/private/profile` and are readable/writable only by the owner.
3. **Master Gate Relational Sync**: Every media document (`/users/{userId}/projects/{projectId}/media/{mediaId}`) requires parent `/users/{userId}/projects/{projectId}` to exist with matching `ownerId`. Every media chunk requires parent `media/{mediaId}` to exist with matching `ownerId`.
4. **Path & ID Hardening**: All path IDs (`userId`, `projectId`, `mediaId`, `chunkId`) must match `^[a-zA-Z0-9_\\-]+$` and have `size() <= 128`.
5. **Anti-Update-Gap & Immortality**: `ownerId`, `uid`, `id`, `projectId`, `mediaId`, and `createdAt` are immutable once created. `createdAt == request.time` on create; `updatedAt == request.time` on update.
6. **Denial-of-Wallet Bounds**: Every string and array is strictly size-bounded (`tracks.size() <= 16`, `clips.size() <= 200`, `waveform.size() <= 256`, chunk `data.size() <= 700000`).

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Unauthenticated Read/Write**: Reading or writing `/users/u1/projects/p1` with `auth == null` -> `PERMISSION_DENIED`.
2. **Unverified Email Spoofing**: Writing with `auth.uid == 'u1'` and `email_verified == false` -> `PERMISSION_DENIED`.
3. **Cross-Tenant Access**: User `u2` reading or listing `/users/u1/projects` -> `PERMISSION_DENIED`.
4. **Owner Spoofing on Create**: User `u1` creating `/users/u1/projects/p1` with `ownerId: 'u2'` -> `PERMISSION_DENIED`.
5. **Shadow / Ghost Field Injection**: Creating a project with an undeclared field `isAdmin: true` -> `PERMISSION_DENIED`.
6. **ID Poisoning**: Creating a project with `projectId` containing 500 chars or invalid characters `bad/id` -> `PERMISSION_DENIED`.
7. **Timestamp Forgery**: Creating a project with backdated `createdAt` (`!= request.time`) -> `PERMISSION_DENIED`.
8. **Immutable Field Mutation**: Updating a project to change `ownerId` or `createdAt` -> `PERMISSION_DENIED`.
9. **Orphaned Media Write**: Creating `/users/u1/projects/nonexistent/media/m1` when parent project does not exist -> `PERMISSION_DENIED`.
10. **Array Overflow (Denial of Wallet)**: Submitting a project with `clips` > 200 items or `tracks` > 16 items -> `PERMISSION_DENIED`.
11. **Oversized Chunk Injection**: Writing a chunk with `data.size() > 700000` -> `PERMISSION_DENIED`.
12. **PII Leak Attempt**: User `u2` calling `get` on `/users/u1/private/profile` -> `PERMISSION_DENIED`.
