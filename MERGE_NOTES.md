# Merge notes — mentorship-cohort-manager

## Merge approach
- Base preserved: `mentorship-cohort-manager-main.zip` (the hosted/main project).
- Feature source: `mentorship-cohort-manager-updated.zip` (Claude's independent-nominator and table-view update).
- Older `mentorship-cohort-manager.zip` was used as the common ancestor to identify which files changed in each branch.
- Main-only content was retained. Updated-only feature files were added. In overlapping files, non-overlapping changes were combined; where both versions changed the same lines, the updated branch's version was selected for those overlapping sections so the requested independent-nominator workflow is applied.
- Original ZIP files were not modified.

## Changes already present in main compared with the previous archive
- Main differs from the previous archive in 113 shared files and has 6 deletions.
- These include backend configuration, authentication/authorization, routers/services/schemas, test files, Docker configuration, frontend routing, shared components, dashboards, mentor workflows, admin pages, styles and build configuration.
- These main-branch changes were retained wherever they did not overlap with the Claude update.

## Claude update applied
- Independent nominator workflow: nominators submit mentors/trainees without cohort-specific context; Admin sees the central nomination pool and allocates nominees to cohorts.
- Added Admin Nominations page and allocation modal.
- Added reusable DataTable, nominee form, city data and debounced search hook.
- Updated nomination, cohort, user, RBAC, seed and demo-nominator backend files, plus the related frontend routing/navigation/login/dashboard/cohort/mentor pages.
- Removed the old cohort-based nominator pages/router/test files where the main branch had not independently changed them.
- Added `CHANGES_NOMINATIONS_AND_TABLES.md` from Claude and `backend/tests/test_nominations_independent.py`.

## Validation performed here
- Python syntax compilation: 52 backend Python files checked; 0 syntax errors.
- Merge conflict markers: none remain.
- Frontend production build was attempted but could not be completed in this environment because the copied `node_modules` lacks the platform-specific optional package `@rollup/rollup-linux-x64-gnu`. This is an environment/dependency-install issue; it is not proof that the frontend source builds successfully.
- Backend automated tests and hosted deployment were not run here.

## Before deployment
1. Keep a backup of the currently deployed main project.
2. Extract this ZIP and install frontend dependencies afresh with `npm ci` in `frontend`.
3. Run frontend build and backend tests in your normal environment.
4. Review environment variables and deployment settings; do not run `seed.py` against production/Atlas because it may wipe data.
5. Deploy only after checking the nomination workflow in a staging environment.
