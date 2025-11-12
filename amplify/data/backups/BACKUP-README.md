# Schema Backup - Pre Epic-01 Implementation

**Date**: 2025-11-12
**Models**: 3 (Project, Specification, Ticket)
**Purpose**: Backup before implementing full 14-model schema

## Current Models
- Project (basic)
- Specification (simplified)
- Ticket (simplified)

## Restore Instructions
If you need to restore this schema:
1. Find the backup file: `ls amplify/data/backups/resource.ts.backup-*`
2. Copy the backup file: `cp amplify/data/backups/resource.ts.backup-YYYYMMDD-HHMMSS amplify/data/resource.ts`
3. Deploy: `npx ampx sandbox --once`

## Backup Details

This backup was created before implementing the complete 14-model schema for Epic-01: Project & Git Management Foundation.

### What Changed After This Backup

The schema will be expanded from 3 models to 14 models:

**Core Entities**:
- Project (enhanced)
- GitRepository
- GitCredential

**Workspace Entities**:
- Workspace
- MonorepoStructure
- MonorepoDependency

**Context Entities**:
- Context
- SpecificationContext

**Specification Entities**:
- SpecificationType
- Specification (enhanced)
- Epic
- Ticket (enhanced)
- TicketDependency

### Safety Notes

- Keep this backup for the duration of Epic-01 implementation
- Don't delete backups until full schema is verified in production
- This is a safety net for quick rollback if needed
