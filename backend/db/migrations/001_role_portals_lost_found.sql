-- Campus Connect MySQL 8 migration (manual, additive).
-- Back up your database before running. Run once, before starting the new backend.
-- The original JPA LostItem entity maps to lost_item using Spring's default naming strategy.

ALTER TABLE lost_item
  ADD COLUMN custody_accepted_at DATETIME(6) NULL,
  ADD COLUMN custody_accepted_by VARCHAR(255) NULL,
  ADD COLUMN custody_location VARCHAR(255) NULL;

CREATE TABLE item_claims (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  item_id BIGINT NOT NULL,
  claimant_email VARCHAR(255) NOT NULL,
  ownership_answer VARCHAR(2000) NOT NULL,
  status VARCHAR(255) NOT NULL DEFAULT 'PENDING',
  created_at DATETIME(6),
  reviewed_at DATETIME(6),
  reviewed_by VARCHAR(255),
  pickup_reference VARCHAR(255),
  handed_over_at DATETIME(6),
  handed_over_by VARCHAR(255),
  CONSTRAINT fk_item_claim_item FOREIGN KEY (item_id) REFERENCES lost_item(id),
  CONSTRAINT uq_claim_item_email UNIQUE (item_id, claimant_email),
  INDEX idx_claim_item (item_id)
);

CREATE TABLE item_images (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  item_id BIGINT NOT NULL,
  claim_id BIGINT NULL,
  uploaded_by VARCHAR(255) NOT NULL,
  content_type VARCHAR(255) NOT NULL,
  data LONGBLOB NOT NULL,
  created_at DATETIME(6),
  CONSTRAINT fk_item_image_item FOREIGN KEY (item_id) REFERENCES lost_item(id),
  CONSTRAINT fk_item_image_claim FOREIGN KEY (claim_id) REFERENCES item_claims(id),
  INDEX idx_item_images_item (item_id),
  INDEX idx_item_images_claim (claim_id)
);
