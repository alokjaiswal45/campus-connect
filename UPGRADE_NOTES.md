# Campus Connect role portals — development branch

This branch is **not yet production-ready**. Do not merge until CI, database migration, role permissions, and the end-to-end workflows have been reviewed.

## URLs

- `/student/login` → `/student/dashboard`
- `/student/onboarding` → legacy student registration and OTP
- `/staff/login` → `/staff/dashboard`
- `/admin/login` → `/admin/dashboard`
- `/super-admin/login` → `/super-admin/dashboard`

The Angular frontend currently uses `http://localhost:8080/api` and HTTP Basic credentials in session storage. **HTTPS and a stronger session design are required before public deployment.**

## Build checks

GitHub Actions runs `npm ci && npm run build` in `frontend` and `mvn -B test package` in `backend`. See the Actions tab for results on the latest commit. Local testing requires Node 22, Java 21, Maven, and a configured MySQL server.

## Lost & Found workflow

1. Student posts a `FOUND` item, optionally with an image.
2. Staff physically receive the item using `PUT /api/staff/items/{itemId}/intake` with `{"storageLocation":"Desk cabinet A-1"}`.
3. Another student submits a private ownership explanation to `POST /api/items/{itemId}/claims`; they may upload one evidence image to `POST /api/claims/{claimId}/evidence`.
4. Staff view claims and evidence, then approve or reject through `PUT /api/staff/claims/{claimId}/review`.
5. Staff verify the college ID and pickup reference in person and record handover through `PUT /api/staff/claims/{claimId}/handover`.

Item images and private evidence are served through authenticated `GET /api/images/{imageId}`. The UI retrieves image blobs with the user's credentials; direct unauthenticated image URLs will not work.

## Dispute workflow\n\nA student can appeal a rejected or approved claim using `POST /api/claims/{claimId}/disputes`. Administrators can review open appeals at `GET /api/admin/disputes` and record independent decisions with `PUT /api/admin/disputes/{id}/resolve`. An unresolved appeal blocks physical handover. An upheld appeal records the decision but does not automatically reassign ownership or bypass in-person verification.\n\n## Operational cautions

- Additive MySQL scripts are provided at `backend/db/migrations/001_role_portals_lost_found.sql` and `002_claim_disputes.sql`. **Back up your database and review the schema before applying them manually, in order**. They have not been validated against the live database and are not auto-applied.
- Item photos are stored in MySQL. Configure database storage and backups for image volume.
- Image uploads accept JPEG/PNG/WebP up to 5 MB. MIME signatures are checked, but a dedicated image decoder, antivirus scan, metadata stripping, and request-rate limiting are recommended for production.
- Concurrency protection uses pessimistic row locking on the item row. Validate against the target MySQL configuration with parallel integration tests.
- Staff and admin account provisioning currently uses administrator-supplied initial passwords. Add a secure password-reset/invitation flow before real deployment.
- Staff inventory browsing, basic admin disputes and aggregate analytics are implemented. End-to-end MySQL integration tests, upload hardening, production deployment and operational review remain incomplete.
- Never commit MySQL, SMTP, admin, or super-admin credentials to GitHub. Configure them outside tracked files.
