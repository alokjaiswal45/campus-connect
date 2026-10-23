-- Additive, idempotent migration. Apply using a schema-maintenance account before startup.
CREATE TABLE IF NOT EXISTS password_resets (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(254) NOT NULL,
    code_hash VARCHAR(255) NOT NULL,
    created_at DATETIME(6) NOT NULL,
    expires_at DATETIME(6) NOT NULL,
    attempts INT NOT NULL DEFAULT 0,
    used BIT NOT NULL DEFAULT 0,
    INDEX idx_password_reset_email_created (email, created_at)
);
