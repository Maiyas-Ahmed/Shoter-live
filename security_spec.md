# Security Specification — Lone Wolf 3D (Firestore Rules)

## 1. Data Invariants
1. **Guest-First + Optional Google Identity**: Players enter immediately with a Name (1–24 chars) and 4-digit ID (`^[0-9]{4}$`), without mandatory authentication. If a player links a Google account (`googleUid != ''`), updates to their profile require `request.auth != null && request.auth.uid == existing().googleUid && request.auth.token.email_verified == true`.
2. **Strict Schema & Zero Shadow Fields**: Every collection enforces `keys().hasAll(...)` and `keys().hasOnly(...)` on create, and `affectedKeys().hasOnly(...)` per named action on update.
3. **Path Variable Hardening**: Every document ID (`playerId`, `requestId`, `roomId`, `participantId`, `eventId`) must pass `isValidId(id)` (`^[a-zA-Z0-9_\-]+$`, max 128 chars).
4. **Immutable Ownership & Timestamps**: `createdAt`, `playerId`, `roomId`, `hostId`, `fromId`, `toId` cannot be altered after creation. `createdAt == request.time` on create and `updatedAt == request.time` on update.
5. **Relational Integrity (Master Gate)**: Subcollections (`/rooms/{roomId}/participants` and `/rooms/{roomId}/events`) verify parent `/rooms/{roomId}` exists via `exists()` / `get()` and reject writes if the parent room is `'finished'`.
6. **Terminal State Locking**: Once a room reaches `status == 'finished'`, no further updates are permitted.

## 2. "Dirty Dozen" Adversarial Payloads (Must Fail)
1. **Shadow Field Injection on Player**: `{ ..., "isAdmin": true }` -> Rejected by `keys().hasOnly(...)`.
2. **Oversized Name DoS**: `{ ..., "name": "<100KB string>" }` -> Rejected by `data.name.size() <= 24`.
3. **Invalid 4-Digit Tag**: `{ ..., "tag4": "ABCD" }` -> Rejected by `data.tag4.matches('^[0-9]{4}$')`.
4. **Google UID Spoofing**: Creating or updating a player with `"googleUid": "victim_uid"` while unauthenticated or mismatched -> Rejected by `request.auth.uid == incoming().googleUid`.
5. **Poisoned Document ID**: `/rooms/../../admin` or 1.5KB ID -> Rejected by `isValidId()`.
6. **Post-Finish Room Tampering**: Updating `scoreA` or `matchWinner` after `status == 'finished'` -> Rejected by `existing().status != 'finished'`.
7. **Out-of-Bounds Score**: Updating `scoreA: 99` -> Rejected by `data.scoreA >= 0 && data.scoreA <= 5`.
8. **Invalid Weapon ID**: Setting `weaponId: "rpg_nuke"` -> Rejected by enum allowlist `['mp40', 'ak47', 'm1887', 'awm']`.
9. **Client Timestamp Forgery**: Setting `createdAt` to a past timestamp -> Rejected by `incoming().createdAt == request.time`.
10. **Orphaned Participant**: Writing `/rooms/nonexistent/participants/p1` -> Rejected by `exists(/databases/.../rooms/$(roomId))`.
11. **HP Overflow Cheat**: Setting `hp: 9999` -> Rejected by `data.hp >= 0 && data.hp <= 200`.
12. **Immutable Host Hijack**: Changing `hostId` on room update -> Rejected by `incoming().hostId == existing().hostId`.
