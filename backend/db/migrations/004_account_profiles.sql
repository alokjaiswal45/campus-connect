-- Additive migration. Use a schema-maintenance account before starting with ddl-auto=validate.
CREATE TABLE IF NOT EXISTS account_profiles (
    user_id BIGINT NOT NULL PRIMARY KEY,
    department VARCHAR(120),
    about VARCHAR(500),
    photo MEDIUMBLOB
);
