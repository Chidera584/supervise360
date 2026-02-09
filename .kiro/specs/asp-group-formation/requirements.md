# Requirements Document

## Introduction

The Supervise360 ASP-based Student Group Formation System automatically creates balanced student groups for final-year project supervision using Answer Set Programming (ASP) via the Clingo solver. The system ensures fair distribution of academic abilities across groups while maintaining departmental boundaries and handling edge cases through intelligent fallback strategies.

## Glossary

- **System**: The ASP-based Student Group Formation System
- **ASP_Engine**: The Answer Set Programming engine using Clingo solver
- **Student**: A student record with name, GPA, and department information
- **GPA_Tier**: Classification of students based on GPA ranges (HIGH, MEDIUM, LOW)
- **Group**: A collection of exactly 3 students assigned together
- **Ideal_Group**: A group containing 1 HIGH + 1 MEDIUM + 1 LOW tier student
- **Fallback_Group**: A group with non-ideal tier distribution used when perfect balance is impossible
- **Department**: Academic department boundary that students cannot cross in grouping
- **Clingo_Solver**: The ASP solver engine that processes constraints and generates solutions

## Requirements

### Requirement 1: Data Input Processing

**User Story:** As a system administrator, I want to input student data from the MySQL database, so that the system can process students for group formation.

#### Acceptance Criteria

1. WHEN student data is provided, THE System SHALL validate each student record contains name, GPA, and department
2. WHEN a student GPA is provided, THE System SHALL classify it into the correct tier (HIGH: 3.80-5.00, MEDIUM: 3.30-3.79, LOW: 0.00-3.29)
3. WHEN invalid GPA values are encountered, THE System SHALL reject the input and return a descriptive error
4. THE System SHALL accept GPA values as decimal numbers with precision up to 2 decimal places
5. WHEN processing student data, THE System SHALL group students by department for separate processing

### Requirement 2: ASP Constraint Generation

**User Story:** As a system administrator, I want the system to generate proper ASP constraints, so that the Clingo solver can find valid group formations.

#### Acceptance Criteria

1. THE System SHALL generate ASP facts for each student with their tier classification and department
2. THE System SHALL generate constraints ensuring every group contains exactly 3 students
3. THE System SHALL generate constraints ensuring every student is assigned to exactly one group
4. THE System SHALL generate constraints preventing students from different departments being grouped together
5. THE System SHALL generate optimization rules prioritizing ideal group composition (1 HIGH + 1 MEDIUM + 1 LOW)

### Requirement 3: Clingo Solver Integration

**User Story:** As a system administrator, I want the system to interface with Clingo solver, so that ASP constraints can be solved to produce group assignments.

#### Acceptance Criteria

1. WHEN ASP constraints are generated, THE System SHALL invoke the Clingo solver with the constraint set
2. WHEN Clingo returns a solution, THE System SHALL parse the solution into group assignments
3. IF Clingo cannot find a solution, THEN THE System SHALL return an error indicating constraint unsatisfiability
4. THE System SHALL validate that Clingo solutions satisfy all hard constraints before accepting them
5. WHEN multiple solutions exist, THE System SHALL select the solution with maximum ideal groups

### Requirement 4: Ideal Group Formation

**User Story:** As a system administrator, I want to maximize ideal group formations, so that students receive optimal peer learning opportunities.

#### Acceptance Criteria

1. WHEN sufficient students exist in all tiers, THE System SHALL form groups with 1 HIGH + 1 MEDIUM + 1 LOW students
2. THE System SHALL prioritize creating as many ideal groups as possible before using fallback strategies
3. WHEN calculating ideal groups, THE System SHALL determine the maximum number based on the limiting tier
4. THE System SHALL ensure ideal groups are formed first before applying any fallback rules
5. WHEN all students can be placed in ideal groups, THE System SHALL not create any fallback groups

### Requirement 5: Fallback Strategy Implementation

**User Story:** As a system administrator, I want intelligent fallback strategies when ideal distribution is impossible, so that all students are still grouped appropriately.

#### Acceptance Criteria

1. WHEN insufficient LOW tier students exist, THE System SHALL create fallback groups with 1 HIGH + 2 MEDIUM + 0 LOW
2. WHEN insufficient HIGH tier students exist, THE System SHALL create fallback groups with 0 HIGH + 1 MEDIUM + 2 LOW
3. WHEN insufficient MEDIUM tier students exist, THE System SHALL create fallback groups with 2 HIGH + 0 MEDIUM + 1 LOW
4. WHEN multiple tiers are insufficient, THE System SHALL apply fallback strategies in priority order: maximize ideal groups first, then single-tier fallbacks
5. THE System SHALL ensure no student remains ungrouped after applying all fallback strategies

### Requirement 6: Complete Assignment Guarantee

**User Story:** As a system administrator, I want every student to be assigned to a group, so that no student is excluded from the supervision process.

#### Acceptance Criteria

1. THE System SHALL assign every input student to exactly one group
2. WHEN the total number of students is not divisible by 3, THE System SHALL handle remainder students through fallback strategies
3. IF any student remains unassigned after processing, THEN THE System SHALL return an error
4. THE System SHALL validate that the total number of students in all groups equals the input student count
5. WHEN validating assignments, THE System SHALL ensure no student appears in multiple groups

### Requirement 7: Departmental Boundary Enforcement

**User Story:** As a system administrator, I want students grouped only within their departments, so that departmental supervision structures are maintained.

#### Acceptance Criteria

1. THE System SHALL process each department's students independently
2. WHEN forming groups, THE System SHALL never place students from different departments together
3. THE System SHALL return separate group lists for each department
4. WHEN a department has fewer than 3 students, THE System SHALL return an error for that department
5. THE System SHALL validate that all students in each group belong to the same department

### Requirement 8: Solution Validation and Output

**User Story:** As a system administrator, I want validated group assignments as output, so that I can confidently use the results for supervision assignment.

#### Acceptance Criteria

1. WHEN returning group assignments, THE System SHALL validate all hard constraints are satisfied
2. THE System SHALL return group assignments with student names, GPAs, and tier classifications
3. THE System SHALL include group composition statistics (number of ideal vs fallback groups)
4. THE System SHALL return results in a structured format suitable for database storage
5. WHEN validation fails, THE System SHALL return detailed error information indicating which constraints were violated

### Requirement 9: Error Handling and Edge Cases

**User Story:** As a system administrator, I want comprehensive error handling, so that I can understand and resolve any issues with group formation.

#### Acceptance Criteria

1. WHEN invalid input data is provided, THE System SHALL return specific error messages indicating the problem
2. WHEN Clingo solver fails or times out, THE System SHALL return an appropriate error message
3. WHEN a department has insufficient students for any groups, THE System SHALL return a descriptive error
4. THE System SHALL handle empty input gracefully and return an appropriate message
5. WHEN system dependencies (Clingo) are unavailable, THE System SHALL return a clear error message

### Requirement 10: ASP Program Generation and Parsing

**User Story:** As a developer, I want to generate and parse ASP programs programmatically, so that the system can interface with Clingo solver effectively.

#### Acceptance Criteria

1. THE System SHALL generate valid ASP syntax for student facts, constraints, and optimization rules
2. WHEN parsing Clingo output, THE System SHALL extract group assignments from the answer set
3. THE System SHALL validate ASP program syntax before passing to Clingo
4. THE System SHALL handle Clingo output parsing errors gracefully
5. THE System SHALL support round-trip conversion: data → ASP program → Clingo → parsed results → validated output