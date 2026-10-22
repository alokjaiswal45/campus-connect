# Campus Connect — Angular + Spring Boot + MySQL

A full-stack campus portal with a student dashboard, dynamic academic branches/subjects, admin-managed PDF resources, SEE/CIE question papers, and Lost & Found.

## Prerequisites
- Java 21, Maven 3.9+
- Node.js 20+ and npm
- MySQL Server 8+ and MySQL Workbench (Workbench is the GUI, MySQL Server runs the database)

## 1. Database setup in MySQL Workbench
Connect to your local MySQL Server, open a SQL tab, run:
```sql
CREATE DATABASE IF NOT EXISTS campus_connect CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```
Tables are created/updated automatically by Spring Data JPA when the backend starts.

## 2. Run the backend
In a terminal from `backend/`:

Linux/macOS:
```bash
export DB_USER=campus_connect_app
export DB_PASSWORD='your-mysql-password'
export ADMIN_EMAIL='admin@campus.local'
export ADMIN_PASSWORD='choose-a-strong-password'
mvn spring-boot:run
```
Windows PowerShell:
```powershell
$env:DB_USER='campus_connect_app'
$env:DB_PASSWORD='your-mysql-password'
$env:ADMIN_EMAIL='admin@campus.local'
$env:ADMIN_PASSWORD='choose-a-strong-password'
mvn spring-boot:run
```
Backend runs at http://localhost:8080. Test http://localhost:8080/api/health. On first start it creates an admin user with your configured credentials. **Set ADMIN_PASSWORD before first launch and do not commit passwords.**

## 3. Run Angular
In another terminal from `frontend/`:
```bash
npm install
npm start
```
Visit http://localhost:4200.

## 4. Try the app
1. Sign in using `ADMIN_EMAIL` / `ADMIN_PASSWORD`.
2. Open **Manage Campus** and add a branch (e.g. AIML).
3. Add a subject to a branch and semester.
4. Upload a study PDF or SEE/CIE question paper.
5. Open Study Resources / Question Papers and filter by branch, semester, subject, exam.
6. Register a student account and post a Lost & Found item.

## REST endpoints
- `POST /api/auth/register`, `GET /api/auth/me`
- `GET/POST /api/branches`, `DELETE /api/branches/{id}`
- `GET/POST /api/subjects`, `DELETE /api/subjects/{id}`
- `GET/POST /api/documents`, `GET /api/documents/{id}/file`, `DELETE /api/documents/{id}`
- `GET/POST /api/items`, `PUT /api/items/{id}/close`

All POST/DELETE operations for academic management require ADMIN role. Lost & Found posting requires login. Authentication uses HTTP Basic with bcrypt-hashed passwords and sessionStorage for the local development demo. For a production deployment, use HTTPS and a more robust session/token strategy, configure rate limits and audit logs, enforce PDF scanning and MIME checks, add pagination, improve upload streaming, use schema migrations, and move PDFs to object storage. This is a functional local development starter, **not a production-hardened service**.

## Design notes
- `subjects` references `branches`, with a semester number on each subject. This allows branches and subjects to be added without code changes. Semesters 1–8 are UI options; change this if your college requires other values.
- `academic_documents` stores metadata and random storage filenames; PDFs live in `backend/uploads` by default.
- Deleting a branch/subject with dependent records may be blocked by foreign-key constraints; remove dependencies first.
- The frontend currently expects the backend at `http://localhost:8080/api` and allows the Angular dev server at `http://localhost:4200`.

## Account profiles and passwords

Students, teachers, staff and admins use **Forgot password?** on their role login page or **My profile → Change password with email OTP** to reset their own password. Reset codes expire after five minutes, allow five attempts, and have a 60-second resend delay and five-request hourly limit per account. Only active, verified STUDENT, TEACHER, STAFF and ADMIN accounts qualify. Neither API accepts an administrator-selected student password. The admin directory exposes identity and access status only; it can activate/deactivate student access without changing credentials or email verification.

Apply `backend/db/migrations/003_student_password_resets.sql` before startup when automatic schema updates are disabled. A development database with Hibernate `ddl-auto=update` can create this table automatically. No existing password data is changed by the migration. SMTP must be configured using the existing mail settings. Code request success responses deliberately do not reveal account existence, eligibility or throttling. SMTP connectivity/authentication is checked before account lookup; an unavailable mail service returns HTTP 503 and a safe error instead of advancing the UI as though a code was sent. Maintainers can inspect sanitized server logs. Password-change notification delivery failure does not undo a successful password change.

A password change replaces the BCrypt hash and invalidates all pending reset codes. Because this application authenticates HTTP Basic credentials on every request, old logins fail on their next API request, and the client clears rejected credentials. The account owner must sign in again. No server-side session tokens are retained. Passwords must be at least eight characters and at most 72 UTF-8 bytes. Resetting to the current password is rejected.

For production database setup and role separation, see [DATABASE_ACCESS.md](DATABASE_ACCESS.md). This patch does not change your local MySQL users or SMTP secrets.

## Gmail OTP sender setup

Registration verification and password recovery use the same backend SMTP sender. A Gmail `535-5.7.8 Username and Password not accepted` log means Gmail rejected the configured sender credentials; it is not an incorrect student OTP. Enable 2-Step Verification for the **sender** Google account and generate a fresh App Password at https://myaccount.google.com/apppasswords. The App Password must belong to exactly the account in `spring.mail.username`. Google revokes App Passwords after the Google account password is changed. Some managed accounts do not offer App Passwords; follow that account's mail administrator policy in that case.

In the existing **untracked** `backend/src/main/resources/application.properties`, set your actual sender email and a fresh App Password (without display spaces):

```properties
spring.mail.host=smtp.gmail.com
spring.mail.port=587
spring.mail.username=YOUR_SENDER_GMAIL_ADDRESS
spring.mail.password=YOUR_FRESH_GOOGLE_APP_PASSWORD
spring.mail.properties.mail.smtp.auth=true
spring.mail.properties.mail.smtp.starttls.enable=true
spring.mail.properties.mail.smtp.starttls.required=true
spring.mail.properties.mail.smtp.connectiontimeout=5000
spring.mail.properties.mail.smtp.timeout=10000
spring.mail.properties.mail.smtp.writetimeout=10000
```

Restart the backend after changing these settings. Request a new code after startup; use the registration code only for registration and the reset code only for recovery. Never paste the App Password into chat, screenshots or committed files. If using environment overrides, update `SPRING_MAIL_USERNAME`/`SPRING_MAIL_PASSWORD` in the environment used by the running backend as well. Do not enable JavaMail protocol debug logging for OTPs.

## Staff custody and OTP response timing

Both LOST reports recovered later and FOUND reports can be received by staff. A successful intake returns and displays an immutable receipt containing item ID/title, locker location, receiving staff email and timestamp. The storage register retains that receipt after handover; search reports by locker or receiving staff as well as item details. Repeating intake for the same locker returns the existing receipt without changing its date or receiver; attempting to assign a different locker is rejected. Claim approval remains blocked until physical receipt is saved. Refreshing claims does not erase action confirmations, and validation errors appear beside the case.

SMTP sending is synchronous for reset/registration **code requests** so an SMTP failure can be reported rather than falsely claiming a code was sent. A sender-health check is reused for 60 seconds after success and for five seconds after failure, avoiding a fresh SMTP connection probe for every request. These caches apply to the sender, not to individual account existence. Five-second connect and ten-second read/write defaults bound individual mail I/O waits; local properties/environment can override them. These limits do not guarantee total delivery time or inbox arrival time.

After a committed password change/reset, the notification email is queued to a bounded background executor; verification no longer waits for that notification's SMTP round-trip. Verification still checks the hashed OTP and updates the database before reporting success. Server logs record code-request and verification processing times in milliseconds without recording email addresses, codes or passwords, so slow SMTP requests can be distinguished from code verification. Gmail/internet delays and the explicit 60-second resend cooldown are separate from verification processing time. No OTP checks, expiry limits or claim-verification safeguards are bypassed to improve speed.

Found-item reports ask only for a general item name, the place found, and an optional photograph. The API requires the found location and discards submitted description/category fields for new found reports. Public listings also hide those fields on older found reports; existing stored details remain available to staff. Lost-item reporting remains unchanged.

Every role has My profile with private profile photo (JPEG/PNG, 1 MB, maximum 2048 pixels per side), display name, optional department and about details, account status, registered email, email OTP password change, and role-specific workspace shortcuts. Email/role cannot be edited through profile APIs. Profile photos are sanitized and resized on the server and are accessible only to the account owner. Apply migration 004 when using schema validation. Admin recovery uses the configured account mailbox and never edits application.properties; bootstrap seeding preserves existing passwords.
