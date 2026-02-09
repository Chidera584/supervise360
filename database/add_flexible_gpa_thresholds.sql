-- ============================================
-- MIGRATION: Add Flexible GPA Tier Thresholds
-- ============================================
-- This migration adds support for flexible, configurable GPA tier thresholds
-- at both global and department levels.

USE supervise360;

-- Create department_settings table for department-specific overrides
CREATE TABLE IF NOT EXISTS department_settings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    department VARCHAR(100) NOT NULL UNIQUE,
    use_custom_thresholds BOOLEAN DEFAULT FALSE,
    gpa_tier_high_min DECIMAL(3, 2) DEFAULT NULL,
    gpa_tier_medium_min DECIMAL(3, 2) DEFAULT NULL,
    gpa_tier_low_min DECIMAL(3, 2) DEFAULT NULL,
    updated_by INT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL,
    
    CONSTRAINT chk_dept_high_threshold CHECK (gpa_tier_high_min IS NULL OR (gpa_tier_high_min >= 0.00 AND gpa_tier_high_min <= 5.00)),
    CONSTRAINT chk_dept_medium_threshold CHECK (gpa_tier_medium_min IS NULL OR (gpa_tier_medium_min >= 0.00 AND gpa_tier_medium_min <= 5.00)),
    CONSTRAINT chk_dept_low_threshold CHECK (gpa_tier_low_min IS NULL OR (gpa_tier_low_min >= 0.00 AND gpa_tier_low_min <= 5.00)),
    
    INDEX idx_department (department),
    INDEX idx_custom_thresholds (use_custom_thresholds)
) ENGINE=InnoDB;

-- Update system_settings descriptions to clarify they are global defaults
UPDATE system_settings 
SET description = 'Minimum GPA for HIGH tier (Global Default)'
WHERE setting_key = 'gpa_tier_high_min';

UPDATE system_settings 
SET description = 'Minimum GPA for MEDIUM tier (Global Default)'
WHERE setting_key = 'gpa_tier_medium_min';

UPDATE system_settings 
SET description = 'Minimum GPA for LOW tier (Global Default)'
WHERE setting_key = 'gpa_tier_low_min';

-- Insert default global thresholds if they don't exist
INSERT IGNORE INTO system_settings (setting_key, setting_value, setting_type, description, is_public) VALUES 
('gpa_tier_high_min', '3.80', 'number', 'Minimum GPA for HIGH tier (Global Default)', true),
('gpa_tier_medium_min', '3.30', 'number', 'Minimum GPA for MEDIUM tier (Global Default)', true),
('gpa_tier_low_min', '0.00', 'number', 'Minimum GPA for LOW tier (Global Default)', true);

-- Success message
SELECT 'Migration completed successfully! Flexible GPA thresholds are now available.' AS status;
