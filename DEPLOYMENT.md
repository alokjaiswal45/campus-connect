# Campus Connect deployment checklist

This branch is **not deployed**. Do not merge or publish until the checks below are complete.

## Architecture

- Angular frontend: build with `cd frontend && npm ci && npm run build`.
- Java 21 Spring Boot backend: build with `cd backend && mvn test package`.
- MySQL 8 database. Back up your existing schema and data before changing anything.
- Serve the Angular static build over HTTPS. Reverse proxy `/api/**` on the **same public origin** to the Spring Boot backend at port 8080. Do not expose MySQL publicly.
- In local development, Angular calls `http://localhost:8080/api`. On any non-local hostname it calls `<current-origin>/api`.
- Set `APP_CORS_ALLOWED_ORIGINS` to the actual HTTPS frontend origin if hosting API separately. Same-origin hosting is preferred.

## Before startup

1. Inspect existing tables using `SHOW CREATE TABLE lost_item`, `SHOW CREATE TABLE item_claims`, and `SHOW CREATE TABLE item_images` as appropriate. Do **not** blindly rerun scripts on existing tables.
2. Apply `backend/db/migrations/001_role_portals_lost_found.sql` and `002_claim_disputes.sql` **only if those changes are not already present**. Both scripts are non-idempotent; use a staging copy of your database first.
3. Supply MySQL, SMTP, and bootstrap account secrets via your hosting provider's secret manager or untracked configuration. Never commit `application.properties` with passwords.
4. Use strong unique passwords for admin/super-admin and ensure student OTP verification works with the real college mail domain.
5. Set production TLS, secure reverse-proxy headers, database backups, and monitoring. Configure strict network restrictions for backend and DB.
6. Complete an HTTP-level role permission matrix and full student→staff→admin dispute and pickup workflow on staging. Confirm no other student can view private proof or claim answers.
7. Uploaded JPEG/PNG files are decoded and re-encoded to strip metadata, with 5 MB encoded-size and 25-million-pixel limits. **This is not antivirus scanning**: independently review malware scanning, decompression/resource limits, upload throttling, and total storage quotas before production.
8. **Authentication risk:** the Angular client currently stores a Base64-encoded HTTP Basic username/password in `sessionStorage` (`cc_auth`). Base64 is not encryption. This is a release blocker for a public service until authentication is redesigned around short-lived credentials and appropriately secured sessions/tokens, with an XSS review.
9. Add request throttling for registration, login, OTP verification and public read endpoints; OTP resend is currently limited per email, not per client/IP.
10. Set explicit frontend Content Security Policy and secure headers at the reverse proxy; validate logout and authorization after role changes.
11. Check GitHub Actions **frontend**, **backend**, and **mysql-migrations** jobs. Passing CI does not prove production readiness.

## Deployment verification

- Test HTTPS URLs `/student/login`, `/staff/login`, `/admin/login`, `/super-admin/login` with browser refresh/deep links.
- Verify a non-admin cannot access `/api/admin/**` or `/api/staff/**`.
- Verify SMTP/OTP, role creation, document download, image upload, custody intake, approval, dispute resolution, and in-person handover.
- Verify backup restoration and restart persistence.
- Require explicit repository-owner approval before merging the draft PR into `main` or deploying publicly.

## Student password update

Apply `backend/db/migrations/003_student_password_resets.sql` before enabling the new password-reset endpoints when Hibernate auto-update is disabled. This migration creates only a new table and is idempotent. Follow `DATABASE_ACCESS.md` to separate the restricted runtime user from the schema-maintenance user. The `prod` profile validates an already-migrated schema and rejects the username `root`; it does not change database grants automatically.

Verify `/student/forgot-password` against an actual registered college mailbox and `/student/change-password` while signed in. Confirm old credentials fail on the next API request and the admin portal cannot change student passwords. Keep the existing public-deployment authentication review above: this update retains HTTP Basic and does not replace it with cookie/token sessions.
