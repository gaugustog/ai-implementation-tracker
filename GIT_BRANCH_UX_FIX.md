# Git Branch Selection UX Fix

## Problem Identified

The original implementation showed a branch dropdown selector **before** authenticating with GitHub, which caused issues:

1. ❌ Cannot fetch branches from private repositories without PAT (Personal Access Token)
2. ❌ Hardcoded branch list (main, master, develop) might not match actual repository branches
3. ❌ Poor user experience - asking for branch selection before validating repository access

## Solution Implemented

Complete redesign of the Git Integration workflow:

### New Flow

```
1. User enters Repository URL + PAT
   ↓
2. Click "Connect Repository"
   ↓
3. Frontend fetches actual branches from GitHub API (using PAT)
   ↓
4. Auto-selects default branch (main → master → first available)
   ↓
5. Connects to repository with detected default branch
   ↓
6. After connection: Shows dropdown with actual branches from repo
   ↓
7. User can switch branches (triggers re-sync)
```

---

## Changes Made

### 1. Frontend Component (`components/git/GitIntegrationPanel.tsx`)

#### Added State Management
```typescript
const [availableBranches, setAvailableBranches] = useState<string[]>([]);
const [selectedBranch, setSelectedBranch] = useState('');
const [loadingBranches, setLoadingBranches] = useState(false);
```

#### New Function: `fetchBranches()`
- Fetches actual branches from GitHub API using PAT
- Extracts owner/repo from GitHub URL
- Auto-detects default branch (prioritizes: main → master → first available)
- Falls back to hardcoded list if fetch fails

```typescript
const fetchBranches = async (url: string, token: string) => {
  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/branches`, {
    headers: {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github.v3+json',
    },
  });

  const branches = await response.json();
  const branchNames = branches.map((b: any) => b.name);

  setAvailableBranches(branchNames);
  // Auto-select default branch...
};
```

#### Updated `handleConnect()`
- Now calls `fetchBranches()` first
- Connects with auto-detected default branch
- No longer requires user to select branch upfront

#### New Function: `handleBranchChange()`
- Allows switching branches after connection
- Updates repository in DynamoDB
- Triggers automatic re-sync with new branch

```typescript
const handleBranchChange = async (newBranch: string) => {
  await fetch('/api/git', {
    method: 'POST',
    body: JSON.stringify({
      operation: 'changeBranch',
      repositoryId: repository.repositoryId,
      branch: newBranch,
    }),
  });

  await handleSync(); // Re-sync with new branch
};
```

#### UI Changes

**Before Connection:**
```tsx
// ❌ REMOVED: Branch dropdown (can't fetch without PAT)
<FormControl fullWidth>
  <InputLabel>Branch</InputLabel>
  <Select value={branch} onChange={...}>
    <MenuItem value="main">main</MenuItem>
    <MenuItem value="master">master</MenuItem>
    <MenuItem value="develop">develop</MenuItem>
  </Select>
</FormControl>

// ✅ ADDED: Helper text
<Typography variant="caption">
  💡 Branch will be auto-detected. You can change it after connecting.
</Typography>
```

**After Connection:**
```tsx
// ✅ NEW: Branch selector with actual branches
<FormControl fullWidth>
  <InputLabel>Branch</InputLabel>
  <Select
    value={selectedBranch || repository.branch}
    onChange={(e) => handleBranchChange(e.target.value)}
  >
    {availableBranches.map((branch) => (
      <MenuItem key={branch} value={branch}>
        {branch}
        {branch === repository.branch && ' (current)'}
      </MenuItem>
    ))}
  </Select>
</FormControl>
```

---

### 2. Backend API Route (`app/api/git/route.ts`)

#### Added Mock Response for `changeBranch`
```typescript
case 'changeBranch':
  return NextResponse.json({
    message: 'Branch changed successfully (mock)',
    branch: body.branch,
  });
```

---

### 3. Lambda Handler (`amplify/functions/git-integration/handler.ts`)

#### Updated Interface
```typescript
interface GitSyncEvent {
  operation: 'sync' | 'connect' | 'disconnect' | 'changeBranch'; // Added changeBranch
  repositoryId?: string;
  projectId?: string;
  repoUrl?: string;
  accessToken?: string;
  branch?: string;
}
```

#### Added Handler Case
```typescript
switch (request.operation) {
  case 'connect':
    return await handleConnect(request);
  case 'sync':
    return await handleSync(request);
  case 'disconnect':
    return await handleDisconnect(request);
  case 'changeBranch': // ✅ NEW
    return await handleChangeBranch(request);
  default:
    return createResponse(400, { error: 'Invalid operation' });
}
```

#### New Function: `handleChangeBranch()`
```typescript
async function handleChangeBranch(request: GitSyncEvent) {
  const { repositoryId, branch } = request;

  if (!repositoryId || !branch) {
    return createResponse(400, { error: 'Missing repositoryId or branch' });
  }

  await dynamoClient.send(new UpdateCommand({
    TableName: TABLE_NAME,
    Key: { id: repositoryId },
    UpdateExpression: 'SET branch = :branch, syncStatus = :status, updatedAt = :updatedAt',
    ExpressionAttributeValues: {
      ':branch': branch,
      ':status': 'pending', // Needs re-sync
      ':updatedAt': new Date().toISOString(),
    },
  }));

  return createResponse(200, {
    message: 'Branch changed successfully',
    branch,
  });
}
```

---

## User Experience Improvements

### Before (❌ Broken UX)
1. User sees branch dropdown immediately
2. Only 3 hardcoded options: main, master, develop
3. User selects a branch that might not exist
4. Connection fails if branch doesn't exist
5. No way to change branch after connecting

### After (✅ Improved UX)
1. User enters URL + PAT
2. System fetches **actual** branches automatically
3. System auto-selects the default branch
4. Connection succeeds with validated branch
5. After connecting, dropdown shows **all** actual branches
6. User can switch branches anytime (with auto-sync)

---

## Benefits

✅ **Authentication First**: Can't fetch branches without PAT
✅ **Actual Branches**: Shows real branches from the repository
✅ **Auto-Detection**: Smart default branch selection (main → master → first)
✅ **Better Error Handling**: Token validation before connection
✅ **Branch Switching**: Change branches after connection with auto-sync
✅ **Accurate Labels**: Shows which branch is currently synced
✅ **Graceful Fallback**: If fetch fails, uses sensible defaults

---

## Deployment Required

The Lambda function needs to be redeployed with the new `handleChangeBranch` function:

```bash
cd /home/gabri/source/ai-implementation-tracker
npx ampx sandbox --once --outputs-format json --outputs-out-dir .
```

This will update the git-integration Lambda with the new branch change functionality.

---

## Testing Steps

1. **Initial Connection**:
   - Enter repository URL
   - Enter GitHub PAT
   - Click "Connect Repository"
   - Verify: Branches are fetched automatically
   - Verify: Default branch is auto-selected
   - Verify: Connection succeeds

2. **Branch Switching**:
   - After connection, open branch dropdown
   - Verify: All actual branches are listed
   - Select a different branch
   - Verify: System switches branch and re-syncs
   - Verify: Status updates to "syncing" then "synced"

3. **Private Repository**:
   - Test with a private repository
   - Verify: Branches are fetched correctly with PAT
   - Verify: No authentication errors

---

## Files Modified

1. ✅ `components/git/GitIntegrationPanel.tsx` - Complete UX redesign
2. ✅ `app/api/git/route.ts` - Added changeBranch mock response
3. ✅ `amplify/functions/git-integration/handler.ts` - Added changeBranch operation

---

## Related Documentation

- GitHub API Branches Endpoint: `GET /repos/{owner}/{repo}/branches`
- Using authentication: `Authorization: token <PAT>`
- Response format: Array of branch objects with `name` property

---

**Fixed**: 2025-11-08
**Issue Reporter**: User feedback
**Status**: ✅ Ready for deployment
