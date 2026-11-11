# Changes: nominators independent of cohorts + table views

## 1. Nominators are independent of cohorts
**Flow:** Admin creates a nominator login -> nominator nominates mentors/trainees (no cohort) ->
nominees land in a pool -> admin sees them on **Admin > Nominations** -> admin adds them to a cohort ->
admin assigns any cohort mentor to any trainee (no domain rules).

| Area | What changed |
|---|---|
| Nominator UI | One page (`/nominator/dashboard`): nominate trainee/mentor + table of own nominations. No cohort pages. |
| Admin UI | New **Nominations** page (`/admin/nominations`): nominated trainees, nominated mentors, nominator accounts (create, reset password, activate/deactivate). Select rows -> "Add to cohort". |
| Cohort page | "Nominators" tab removed. "Add Mentors / Trainees from Nominations" buttons added. |
| Data | `mentors.cohortId` / `trainees.cohortId` is `null` until an admin adds the person to a cohort. `cohorts.nominatorIds` is gone. |
| Security | Nominators get 403 on every cohort, template, plan and assignment endpoint. They only see their own nominees (no cohort/mentor/progress fields). |

### API
- `POST /api/nominations/mentors`, `POST /api/nominations/trainees` (nominator/admin, no cohort)
- `GET  /api/nominations/mine/mentors|trainees` (own nominations)
- `GET  /api/nominations/mentors|trainees?allocation=unallocated|allocated|all&search=&nominator_id=&page=&limit=` (admin)
- `POST /api/cohorts/{id}/mentors/allocate`, `POST /api/cohorts/{id}/trainees/allocate` body `{ "ids": [...] }` (admin)
- `GET/POST/DELETE /api/users/nominators` (admin; POST body: name, employeeId, email -> temporary password)
- `GET /api/nominator/dashboard` now returns only nomination counts and recent nominations.
- Removed: `nominations_v2` router, `/api/users/cohorts/{id}/nominators`, `/api/nominator/cohorts*`.

## 2. Tables instead of cards
New reusable `components/DataTable.jsx` (pagination, page size, optional checkbox selection).
Converted: admin cohort Mentor Details, admin Assign Mentors, mentor detail modal, mentor dashboard,
batch trainee picker, batch trainee list, attendance rosters (batch page + session history),
and the new nominator/admin nomination lists. Cohort pages now load every page of people (no 100 cap).

## Existing databases
Existing mentors/trainees keep their `cohortId`, so current cohorts keep working.
Old nominator accounts keep working but are no longer tied to cohorts.
`python seed.py` WIPES the database. Do not run it against Atlas.
