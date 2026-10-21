-- MySQL 8: apply after 001_role_portals_lost_found.sql.
-- Back up the database before running this migration.
CREATE TABLE claim_disputes (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  claim_id BIGINT NOT NULL,
  opened_by VARCHAR(255) NOT NULL,
  reason VARCHAR(2000) NOT NULL,
  status VARCHAR(255) NOT NULL DEFAULT 'OPEN',
  created_at DATETIME(6),
  resolved_at DATETIME(6),
  resolved_by VARCHAR(255),
  resolution VARCHAR(2000),
  CONSTRAINT fk_claim_dispute_claim FOREIGN KEY (claim_id) REFERENCES item_claims(id),
  INDEX idx_dispute_claim (claim_id),
  INDEX idx_dispute_status (status)
);
