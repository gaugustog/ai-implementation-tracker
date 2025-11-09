# Debug Logging Guide for Git Integration

## Overview

Comprehensive debug logging has been added to all layers of the Git integration system to help diagnose connection issues.

## Enabling Debug Logs

### Environment Variable

Set `DEBUG_GIT_INTEGRATION=true` in your `.env.local` file:

```env
# Debug Logging (set to 'true' to enable detailed logs)
NEXT_PUBLIC_DEBUG_GIT_INTEGRATION=true  # Frontend logs
DEBUG_GIT_INTEGRATION=true              # Backend/Lambda logs
```

### After Setting

1. **Restart Next.js server** to load new environment variables
2. **Redeploy Lambda functions** to apply Lambda environment variables:
   ```bash
   npx ampx sandbox --once --outputs-format json --outputs-out-dir .
   ```

## Log Locations

### 1. Frontend (Browser Console)

**Prefix**: `[GitIntegration]`

**Location**: Browser DevTools Console (F12)

**Example Logs**:
```
[GitIntegration] handleConnect() called { projectId: 'proj-123', repoUrl: 'https://...', hasToken: true }
[GitIntegration] fetchBranches() called { url: 'https://...', tokenLength: 40 }
[GitIntegration] fetchBranches() - Parsed repo: { owner: 'owner', repo: 'repo' }
[GitIntegration] fetchBranches() - Fetching from GitHub API: https://api.github.com/repos/...
[GitIntegration] fetchBranches() - GitHub API response status: 200
[GitIntegration] fetchBranches() - Branches fetched: ['main', 'develop', 'feature/...']
[GitIntegration] handleConnect() - Step 1 complete, default branch: main
[GitIntegration] handleConnect() - Step 2: Calling /api/git
[GitIntegration] handleConnect() - API response status: 200
[GitIntegration] handleConnect() - Connection successful
```

### 2. API Route (Next.js Server Console)

**Prefix**: `[GitAPI]`

**Location**: Terminal where Next.js dev server is running

**Example Logs**:
```
[GitAPI] POST request received
[GitAPI] Request body: { operation: 'connect', projectId: '...', repoUrl: '...', branch: 'main', hasAccessToken: true }
[GitAPI] Forwarding to Lambda: https://...lambda-url.us-east-1.on.aws/
[GitAPI] Lambda request body: { operation: 'connect', ... , accessToken: '***' }
[GitAPI] Lambda response status: 200
[GitAPI] Lambda response data: { repositoryId: '...', message: '...' }
```

### 3. Lambda Handler (CloudWatch Logs)

**Prefix**: `[GitLambda]`

**Location**: AWS CloudWatch Logs

**Example Logs**:
```
[GitLambda] === Git Integration Handler Invoked ===
[GitLambda] Environment: { TABLE_NAME: '...', BUCKET_NAME: '...', hasKmsKey: true, DEBUG: true }
[GitLambda] Parsed request: { operation: 'connect', projectId: '...', repoUrl: '...', branch: 'main', hasAccessToken: true }
[GitLambda] Routing to handleConnect
[GitLambda] handleConnect() called
[GitLambda] handleConnect() params: { projectId: '...', repoUrl: '...', branch: 'main', hasAccessToken: true, tokenLength: 40 }
[GitLambda] handleConnect() - Step 1: Parsing GitHub URL
[GitLambda] handleConnect() - Parsed repo info: { owner: 'owner', repo: 'repo', branch: 'main' }
[GitLambda] handleConnect() - Step 2: Validating access token with GitHub
[GitLambda] handleConnect() - GitHub repo validated: { name: 'repo', private: true, defaultBranch: 'main' }
[GitLambda] handleConnect() - Step 3: Encrypting access token
[GitLambda] handleConnect() - Token encrypted successfully
[GitLambda] handleConnect() - Step 4: Saving to DynamoDB { repositoryId: '...', tableName: '...', branch: 'main' }
[GitLambda] handleConnect() - Repository saved to DynamoDB
[GitLambda] handleConnect() - Step 5: Triggering initial sync
[GitLambda] handleConnect() - Initial sync triggered
[GitLambda] handleConnect() - Success, returning: { statusCode: 200, body: '...' }
```

## Viewing CloudWatch Logs

### Option 1: AWS Console

1. Go to **AWS Console** → **CloudWatch** → **Log groups**
2. Find log group: `/aws/lambda/amplify-aiimplementationtracker-gabri-sandbox-...-git-integration-lambda`
3. Click on the log stream (sorted by Last Event Time)
4. Search for `[GitLambda]` to filter debug logs

### Option 2: AWS CLI

```bash
# List log streams
aws logs describe-log-streams \
  --log-group-name "/aws/lambda/amplify-aiimplementationtracker-gabri-sandbox-b2247fbe2a-function1351588B-1EG6KQLW2RHH0-gitintegrationlambda" \
  --order-by LastEventTime \
  --descending \
  --max-items 1

# Tail logs
aws logs tail \
  --follow \
  "/aws/lambda/amplify-aiimplementationtracker-gabri-sandbox-b2247fbe2a-function1351588B-1EG6KQLW2RHH0-gitintegrationlambda"
```

## Common Error Patterns

### Error: "Failed to connect repository"

**Check Frontend Logs**:
- Did branch fetching succeed?
- Did the API call to `/api/git` return an error?
- What was the response status and data?

**Check API Route Logs**:
- Was the request forwarded to Lambda?
- What was the Lambda response status?
- Any errors in the API route?

**Check Lambda Logs**:
- Which step failed? (GitHub validation, token encryption, DynamoDB save, sync trigger)
- What's the error message and stack trace?

### Example: Token Validation Failure

```
Frontend:
[GitIntegration] handleConnect() - Step 2: Calling /api/git
[GitIntegration] handleConnect() - API response status: 500
[GitIntegration] handleConnect() - API error: { error: 'Failed to connect repository', details: 'Invalid access token' }

API Route:
[GitAPI] Lambda response status: 500
[GitAPI] Lambda response data: { error: 'Failed to connect repository', details: 'Invalid access token' }

Lambda:
[GitLambda] handleConnect() - Step 2: Validating access token with GitHub
[GitLambda] handleConnect() - Error occurred: { message: 'Bad credentials', stack: '...' }
```

**Solution**: Token is invalid or expired. Generate a new GitHub PAT.

### Example: DynamoDB Table Not Found

```
Lambda:
[GitLambda] handleConnect() - Step 4: Saving to DynamoDB { repositoryId: '...', tableName: '', branch: 'main' }
[GitLambda] handleConnect() - Error occurred: { message: 'ResourceNotFoundException: Requested resource not found', ... }
```

**Solution**: TABLE_NAME environment variable is not set. Check Amplify deployment.

### Example: Missing Environment Variables

```
Lambda:
[GitLambda] Environment: { TABLE_NAME: '', BUCKET_NAME: '', hasKmsKey: false, DEBUG: true }
```

**Solution**: Environment variables not configured. Check `amplify/backend.ts`.

## Debugging Workflow

1. **Enable Debug Logs**:
   ```bash
   # Add to .env.local
   NEXT_PUBLIC_DEBUG_GIT_INTEGRATION=true
   DEBUG_GIT_INTEGRATION=true

   # Restart Next.js
   npm run dev

   # Redeploy Lambda
   npx ampx sandbox --once --outputs-format json --outputs-out-dir .
   ```

2. **Reproduce the Issue**:
   - Open browser DevTools Console (F12)
   - Try to connect a repository
   - Watch logs in all three locations

3. **Identify Where It Fails**:
   - **Frontend**: Did branches fetch? Did API call succeed?
   - **API Route**: Did Lambda call succeed? What status code?
   - **Lambda**: Which step failed? (1-5)

4. **Check Error Details**:
   - Error message
   - Stack trace
   - Request parameters
   - Environment variables

5. **Fix and Test**:
   - Apply fix
   - Redeploy if needed
   - Test again with debug logs
   - Verify success in logs

## Disabling Debug Logs

When debugging is complete:

```env
# .env.local
NEXT_PUBLIC_DEBUG_GIT_INTEGRATION=false
DEBUG_GIT_INTEGRATION=false
```

Or simply remove/comment out these lines.

Then restart Next.js server and redeploy Lambda functions.

## Log Levels

All logs are output to console/CloudWatch with appropriate levels:

- **debugLog()**: Only when DEBUG=true
- **console.log()**: Important events (always logged)
- **console.error()**: Errors (always logged)

## Security Note

Debug logs are configured to **never log sensitive data**:
- Access tokens are shown as `'***'` or `hasAccessToken: true`
- Token lengths are shown for validation
- All other data is logged for debugging

## Files Modified

1. ✅ `components/git/GitIntegrationPanel.tsx` - Frontend debug logs
2. ✅ `app/api/git/route.ts` - API route debug logs
3. ✅ `amplify/functions/git-integration/handler.ts` - Lambda debug logs
4. ✅ `amplify/backend.ts` - Added DEBUG env var to Lambda
5. ✅ `.env.local` - Added debug flags

---

**Created**: 2025-11-08
**Purpose**: Diagnose Git integration connection failures
**Status**: Ready to use
