# Supervise360 Diagrams

This folder contains XML-based diagram files for the Supervise360 project. All files use the **Draw.io (diagrams.net)** XML format and can be opened in:

- [diagrams.net](https://app.diagrams.net/) (online)
- [draw.io](https://draw.io) (online)
- VS Code with the "Draw.io Integration" extension
- Any text editor (they are valid XML)

## Diagram Files

| File | Description |
|------|-------------|
| **01-uml-class-diagram.drawio** | UML class diagram showing main entities (User, Student, Supervisor, ProjectGroup, Project, Report, Evaluation, Message, Notification) with attributes and relationships |
| **02-entity-relation-diagram.drawio** | Entity-Relation diagram of the database schema with tables, primary/foreign keys, and relationships |
| **03-sequence-diagram.drawio** | Sequence diagrams for key flows: User Login, Report Submission, Group Formation, Supervisor Auto-Assignment |
| **04-system-architecture-diagram.drawio** | High-level system architecture: Frontend (React), Backend (Express), MySQL, File Storage, Email |

## How to View

1. **Online**: Go to [app.diagrams.net](https://app.diagrams.net/) → File → Open from → Device → select any `.drawio` file
2. **VS Code**: Install "Draw.io Integration" extension, then open the file
3. **Export**: From draw.io, use File → Export as → PNG/SVG/PDF for documentation

## High-Level Summary

- **UML**: Domain model with User hierarchy, ProjectGroup/GroupMember, Project/Report/Evaluation, and messaging
- **ER**: Database tables and FK relationships (users → students/supervisors, project_groups → group_members/projects, projects → reports/evaluations)
- **Sequence**: Four main flows from user action through API to services and database
- **Architecture**: Three-tier (Client → API → DB) with file storage and email as supporting services
