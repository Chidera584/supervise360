-- Defense Allocations: stores venue/assessor assignments from Defense Scheduling (CSV-based)
-- Links to students via: group.department + group_number in [group_start, group_end]

CREATE TABLE IF NOT EXISTS defense_allocations (
  id INT PRIMARY KEY AUTO_INCREMENT,
  venue_name VARCHAR(255) NOT NULL,
  department VARCHAR(100) NOT NULL,
  group_start INT NOT NULL,
  group_end INT NOT NULL,
  assessors JSON NOT NULL COMMENT 'Array of assessor names',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_dept_range (department, group_start, group_end)
) ENGINE=InnoDB;
