# Supervise360 Diagrams

This folder contains Draw.io (diagrams.net) XML diagram files for the Supervise360 project. All diagrams are aligned with the actual project flow and database schema. Open them in [diagrams.net](https://app.diagrams.net/) or VS Code with the Draw.io extension.

## Diagram Files

| File | Description |
|------|-------------|
| `01-use-case-diagram.drawio` | Use case diagram: Student, Administrator, Supervisor actors and their use cases (no External Supervisor) |
| `02-entity-relation-diagram.drawio` | Entity-relationship diagram: Users, Group, GroupMembers, Project, Reports, Supervisor, Evaluation, Messages, DefenseAllocation, Departments |
| `03-sequence-diagram.drawio` | Sequence diagram: Login, group formation, supervisor assignment, report upload, report review flow |
| `03b-sequence-group-formation.drawio` | Sequence diagram for Group Formation (ASP algorithm) flow |
| `04-system-architecture-diagram.drawio` | Three-layer architecture: Presentation (Student/Admin/Supervisor interfaces), Application (Auth, Grouping, Allocation, Evaluation, Notification, Defense), Data (MySQL tables) |

## How to View

1. **Online**: Go to [app.diagrams.net](https://app.diagrams.net/) → File → Open from → Device → select `.drawio` file
2. **VS Code**: Install "Draw.io Integration" extension, then open any `.drawio` file
