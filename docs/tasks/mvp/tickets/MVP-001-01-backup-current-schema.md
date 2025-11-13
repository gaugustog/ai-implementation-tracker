# MVP-001-01: Backup Current Schema

**Epic**: Epic-01 - Project & Git Management Foundation  
**Day**: 1  
**Estimated Time**: 15 minutes  
**Status**: Todo  
**Priority**: Critical

---

## Objective

Create a backup of the current Amplify data schema before implementing the full 14-model schema. This ensures we can rollback if needed and serves as a reference point.

---

## Current Schema Location

File: `amplify/data/resource.ts`

---

## Current Schema (3 Models)

```typescript
import { type ClientSchema, a, defineData } from '@aws-amplify/backend';

const schema = a.schema({
  Project: a
    .model({
      name: a.string().required(),
      description: a.string(),
      createdAt: a.datetime(),
      updatedAt: a.datetime(),
      specifications: a.hasMany('Specification', 'projectId'),
    })
    .authorization((allow) => [allow.publicApiKey()]),

  Specification: a
    .model({
      type: a.enum(['ANALYSIS', 'FIXES', 'PLANS', 'REVIEWS']),
      content: a.string(),
      fileKey: a.string(), // S3 file key for markdown file
      projectId: a.id().required(),
      project: a.belongsTo('Project', 'projectId'),
      tickets: a.hasMany('Ticket', 'specificationId'),
      createdAt: a.datetime(),
      updatedAt: a.datetime(),
    })
    .authorization((allow) => [allow.publicApiKey()]),

  Ticket: a
    .model({
      title: a.string().required(),
      description: a.string(),
      status: a.enum(['todo', 'in_progress', 'done']),
      specType: a.enum(['ANALYSIS', 'FIXES', 'PLANS', 'REVIEWS']),
      fileKey: a.string(), // S3 file key for markdown file
      specificationId: a.id(),
      specification: a.belongsTo('Specification', 'specificationId'),
      createdAt: a.datetime(),
      updatedAt: a.datetime(),
    })
    .authorization((allow) => [allow.publicApiKey()]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  name: 'specForgeDataAPI',
  authorizationModes: {
    defaultAuthorizationMode: 'apiKey',
    apiKeyAuthorizationMode: {
      expiresInDays: 365,
    },
  },
});
```

---

## Implementation Steps

### 1. Create Backup Directory

```bash
mkdir -p amplify/data/backups
```

### 2. Copy Current Schema

```bash
cp amplify/data/resource.ts amplify/data/backups/resource.ts.backup-$(date +%Y%m%d-%H%M%S)
```

### 3. Document Current State

Create a file documenting what's deployed:

```bash
cat > amplify/data/backups/BACKUP-README.md << 'EOF'
# Schema Backup - Pre Epic-01 Implementation

**Date**: $(date)
**Models**: 3 (Project, Specification, Ticket)
**Purpose**: Backup before implementing full 14-model schema

## Current Models
- Project (basic)
- Specification (simplified)
- Ticket (simplified)

## Restore Instructions
If you need to restore this schema:
1. Copy the backup file: `cp amplify/data/backups/resource.ts.backup-YYYYMMDD-HHMMSS amplify/data/resource.ts`
2. Deploy: `npx ampx sandbox --once`
EOF
```

### 4. Verify Backup

```bash
# Check backup exists
ls -lah amplify/data/backups/

# Verify content matches
diff amplify/data/resource.ts amplify/data/backups/resource.ts.backup-*
```

---

## Acceptance Criteria

- [ ] Backup directory `amplify/data/backups/` exists
- [ ] Current schema is backed up with timestamp
- [ ] BACKUP-README.md exists with restore instructions
- [ ] Backup file size matches original (verify with `ls -lh`)
- [ ] Diff shows no differences between original and backup

---

## Verification Commands

```bash
# Verify backup created
test -f amplify/data/backups/resource.ts.backup-* && echo "✅ Backup exists" || echo "❌ Backup missing"

# Check file size
ls -lh amplify/data/resource.ts amplify/data/backups/resource.ts.backup-*

# Verify content integrity
diff -q amplify/data/resource.ts amplify/data/backups/resource.ts.backup-* && echo "✅ Backup verified" || echo "⚠️ Files differ"
```

---

## Rollback Procedure

If you need to restore the original schema:

```bash
# Find the backup
ls amplify/data/backups/

# Restore
cp amplify/data/backups/resource.ts.backup-YYYYMMDD-HHMMSS amplify/data/resource.ts

# Deploy
npx ampx sandbox --once
```

---

## Notes

- Keep this backup for the duration of Epic-01 implementation
- Don't delete backups until full schema is verified in production
- This is a safety net—the real schema migration will happen in the next ticket

---

## Next Ticket

MVP-002-01: Implement Full 14-Model Schema
