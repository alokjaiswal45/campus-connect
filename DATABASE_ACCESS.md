# Separate app administration from database maintenance

Campus Connect ADMIN accounts manage portal access. They must not receive MySQL credentials, server access, database backups, email inbox access or SMTP secrets. People with server or database maintenance privileges can still modify stored records; an application change cannot remove that capability.

## Database setup (performed by a trusted database maintainer)

1. Use the existing schema-maintenance account to create/upgrade tables, including `backend/db/migrations/003_student_password_resets.sql` and `004_account_profiles.sql`. Keep that account out of the running backend.
2. Create a separate account restricted to the backend host. For a local MySQL server, run the following in the MySQL client, replacing the placeholder with a strong generated secret:

```sql
CREATE USER 'campus_connect_app'@'localhost' IDENTIFIED BY '<generated-runtime-secret>';
GRANT SELECT, INSERT, UPDATE, DELETE ON campus_connect.* TO 'campus_connect_app'@'localhost';
SHOW GRANTS FOR 'campus_connect_app'@'localhost';
```

Do not grant `CREATE USER`, `GRANT OPTION`, global privileges or schema-changing privileges to the runtime account. Match the host to your actual backend deployment; do not use a broad `%` host for convenience. Keep MySQL on a private network/firewall.

3. Set `SPRING_PROFILES_ACTIVE=prod`, `DB_USER=campus_connect_app`, `DB_PASSWORD` and the appropriate `DB_URL` in the backend's environment/secret store. Keep using the existing SMTP environment configuration. `application-prod.yml` uses `ddl-auto=validate`, so the running app cannot create/alter tables. It refuses the username `root` as an additional guard. Audit the actual grants separately; a non-root username can still have excessive privileges.
4. Remove any local untracked `application.properties` overrides that select `root`, a maintenance account, or `ddl-auto=update` before enabling the production profile. Configuration in that file may override YAML defaults.
5. Test sign-in, the email reset flow, uploads and account access controls with this account before switching a deployed service. Back up the database first. Do not delete the maintenance account; restrict its credentials to trusted maintainers.

Hibernate development auto-updates require a separate development/schema owner and are not compatible with the restricted production grants above. Production changes must use the migration process instead. Never put a real database password into committed SQL or configuration files.

## Verification

- ADMIN API responses and User JSON omit password hashes; self-service password resets require a single-use OTP delivered to the account owner. The legacy student current-password endpoint still requires the authenticated student and current password.
- Account reset OTPs are separate from registration OTPs. They are hashed, expire in five minutes, allow five failed guesses, and are invalidated on successful password changes.
- Old Basic credentials fail on the next request after commit. Previously downloaded data cannot be revoked, and already in-flight requests may finish.
- Password updates and access changes produce sanitized server audit logs. Restrict access and retention of those logs. Password-change emails never contain passwords or hashes.
- Run the backend tests and Angular production build. Verify actual SMTP delivery with a real registered student mailbox; unit tests use a mocked mail sender.
