# Campus Connect — updated role model

The application now has four roles:

| Role | Allowed operations |
| --- | --- |
| STUDENT | View academic content, submit Lost & Found reports, claims and disputes |
| TEACHER | View and upload academic PDFs and exam papers |
| STAFF | View and process found-item custody, claim review and handover |
| ADMIN | Manage branches/subjects and employee accounts; view reports, analytics and resolve disputes; **cannot** upload PDFs, post item reports or execute staff handovers |

The former SUPER_ADMIN login, bootstrap and endpoints are removed. Admin is the highest application role.

## Existing database upgrade

**Back up MySQL before changing existing accounts.** Hibernate adds the nullable `users.account_active` column on startup when `ddl-auto=update` is enabled. Legacy null values are treated as active; terminated accounts have `account_active=0`. This prevents OTP verification from restoring terminated employee access.

If you previously used a SUPER_ADMIN account, the old role no longer grants access. After verifying that it is your authorized administrator account, manually migrate that specific account in MySQL Workbench:

```sql
-- Replace with your existing authorized college administrator email.
UPDATE users
SET role = 'ADMIN'
WHERE email = 'your-existing-admin@bmsce.ac.in'
  AND role = 'SUPER_ADMIN';
```

Do **not** change all users' roles indiscriminately. Existing ADMIN accounts remain ADMIN. No other user records or reports need deletion.

## Employee lifecycle

An Admin creates employees through **Manage Campus → Employee management** and selects TEACHER or STAFF. Each employee needs a unique college email and a 12–72 character temporary password. Termination deactivates the account while preserving documents, reports and audit records. Re-registration with the same email does not reactivate it.

## Uploads and configuration

Teachers use `/teacher/login` and their Academic resource studio to publish PDFs. Multipart limits are 20 MB per file and 22 MB per request. Administrators cannot upload or delete PDFs.

The existing Basic Auth token in browser `sessionStorage` is a **local-development-only security limitation**. Replace it with a secure session strategy before public deployment. Do not commit application.properties, database passwords or mail credentials.

## Verification checklist

- Student POST /api/items: allowed; Admin/Teacher/Staff: forbidden.
- Teacher POST /api/documents: allowed; Admin/Student/Staff: forbidden.
- Admin POST /api/branches, /api/subjects: allowed.
- Admin POST /api/admin/users/staff with role TEACHER or STAFF: allowed.
- Admin PUT /api/admin/users/{id}/terminate: employee access revoked; audit history preserved.
- Staff PUT /api/staff/items/{id}/intake and claim review/handover: allowed; Admin: forbidden.
- Admin GET /api/items and GET /api/admin/analytics: allowed.
- Admin GET/PUT /api/admin/disputes: allowed for independent dispute review.
- /super-admin routes and /api/super-admin endpoints: removed.

Changes are on `feature/role-based-portals` only; `main` is untouched.
