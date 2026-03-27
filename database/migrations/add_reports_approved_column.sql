-- Adds outcome column for supervisor report review (POST /api/reports/:id/review).
-- If you see "Unknown column 'approved' in 'field list'", run this once on MySQL.
-- New deployments also add this automatically via ensureReportsApprovedColumn() on server startup.

ALTER TABLE reports
  ADD COLUMN approved TINYINT(1) NULL DEFAULT NULL COMMENT '1=approved, 0=changes required' AFTER review_comments;
