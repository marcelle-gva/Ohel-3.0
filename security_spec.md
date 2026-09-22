# Security Specification - Ohel Application

## Data Invariants
1. **User Ownership**: All private data (tasks, finance, spiritual, etc.) must be owned by the authenticated user (`userId == auth.uid`).
2. **Institutional Isolation**: Users within an institution can only see other users and members of the same institution.
3. **Audit Trails**: Critical operations (create/delete task) must have a corresponding audit log created in the same transaction.
4. **Rate Limiting**: Users are subject to a burst rate limit of 3 tasks every 10 seconds to prevent resource exhaustion.
5. **Role-Based Access**: Management functions (missions, rankings, group management) are restricted to users with `ADMIN` or `MANAGER` roles.

## The "Dirty Dozen" Payloads (Attack Vectors)

| ID | Vector | Collection | Malicious Payload / Query | Expected Result |
|---|---|---|---|---|
| 1 | Identity Spoofing | `/tasks` | `{ "userId": "victim_uid", "title": "Hacked" }` | `PERMISSION_DENIED` |
| 2 | State Transition Bypass | `/tasks/{id}` | Update `{ "status": "APPROVED" }` as a regular member | `PERMISSION_DENIED` |
| 3 | Resource Poisoning | `/tasks` | Create task with 2MB title string | `PERMISSION_DENIED` |
| 4 | Identity integrity leak | `/users` | Query `collection('users')` without institution filter | `PERMISSION_DENIED` |
| 5 | Cross-Tenant Read | `/users/{victim_id}` | Access user profile from different institution | `PERMISSION_DENIED` |
| 6 | Orphaned Task | `/tasks` | Create task without audit log | `PERMISSION_DENIED` |
| 7 | Role Escalation | `/users/{my_id}` | Update `{ "role": "ADMIN" }` on self profile | `PERMISSION_DENIED` |
| 8 | Blanket Notification Scrape | `/notifications` | Query `collection('notifications')` without `userId` filter | `PERMISSION_DENIED` |
| 9 | Shadow Update | `/groups/{id}` | Update group with additional `{"isSecret": true}` field | `PERMISSION_DENIED` |
| 10 | Immutable Field Mutate | `/tasks/{id}` | Update `{ "createdAt": "2000-01-01" }` | `PERMISSION_DENIED` |
| 11 | ID Poisoning | `/tasks` | Use document ID with 1KB and special characters | `PERMISSION_DENIED` |
| 12 | Unverified Access | Any | Perform write/read with `email_verified: false` | `PERMISSION_DENIED` |

## Test Runner (Logic Verification)
A complete `firestore.rules.test.ts` would be required for local testing. In this environment, we rely on the Red Team Audit logic in the CoT.

## Vulnerability Analysis & Delta Report
- **Issue**: Rules for `users` and `members` were using `get()` and `exists()` in a way that caused `permission-denied` for collection listeners because they didn't follow the "Query Enforcer" pattern strictly.
- **Fix**: Refactor `allow list` rules to perform strict relational checks on `resource.data` and simplify the auth checks.
- **Fix**: Implement strict `email_verified` check across all write operations.
