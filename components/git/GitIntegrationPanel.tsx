'use client';

import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Alert,
  CircularProgress,
  Chip,
  Stack,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@mui/material';
import { GitHub, Sync, Link as LinkIcon, LinkOff, SwapHoriz } from '@mui/icons-material';

interface GitIntegrationPanelProps {
  projectId: string;
  onConnected?: (repositoryId: string) => void;
  onSyncComplete?: (snapshotId: string, repositoryId: string) => void;
}

interface RepositoryStatus {
  repositoryId?: string;
  repoUrl?: string;
  branch?: string;
  syncStatus?: 'pending' | 'syncing' | 'synced' | 'failed';
  lastSyncedAt?: string;
  lastCommitHash?: string;
}

export function GitIntegrationPanel({ projectId, onConnected, onSyncComplete }: GitIntegrationPanelProps) {
  const [repoUrl, setRepoUrl] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [availableBranches, setAvailableBranches] = useState<string[]>([]);
  const [selectedBranch, setSelectedBranch] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [repository, setRepository] = useState<RepositoryStatus | null>(null);

  // Debug logging helper
  const DEBUG = process.env.NEXT_PUBLIC_DEBUG_GIT_INTEGRATION === 'true';
  const debugLog = (...args: any[]) => {
    if (DEBUG) {
      console.log('[GitIntegration]', ...args);
    }
  };

  // Load existing repository when component mounts
  useEffect(() => {
    const loadExistingRepository = async () => {
      if (!projectId) return;

      debugLog('useEffect - Loading existing repository for project:', projectId);
      setLoading(true);

      try {
        const response = await fetch('/api/git', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            operation: 'getByProject',
            projectId,
          }),
        });

        if (!response.ok) {
          debugLog('useEffect - No repository found or error');
          return;
        }

        const data = await response.json();
        debugLog('useEffect - Repository loaded:', data);

        if (data.repository) {
          setRepository({
            repositoryId: data.repository.id,
            repoUrl: data.repository.repoUrl,
            branch: data.repository.branch,
            syncStatus: data.repository.syncStatus,
            lastSyncedAt: data.repository.lastSyncedAt,
            lastCommitHash: data.repository.lastCommitHash,
          });

          setSelectedBranch(data.repository.branch);

          // Fetch branches using the stored encrypted token
          debugLog('useEffect - Fetching branches for repository');
          try {
            const branchesResponse = await fetch('/api/git', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                operation: 'getBranches',
                repositoryId: data.repository.id,
              }),
            });

            if (branchesResponse.ok) {
              const branchesData = await branchesResponse.json();
              debugLog('useEffect - Branches loaded:', branchesData.branches?.length);
              setAvailableBranches(branchesData.branches || []);
            }
          } catch (branchError) {
            debugLog('useEffect - Error loading branches:', branchError);
            // Non-critical error, just means branch switching won't be available
          }
        }
      } catch (err) {
        debugLog('useEffect - Error loading repository:', err);
        // Silently fail - no repository exists yet
      } finally {
        setLoading(false);
      }
    };

    loadExistingRepository();
  }, [projectId]);

  const fetchBranches = async (url: string, token: string) => {
    debugLog('fetchBranches() called', { url, tokenLength: token.length });
    setLoadingBranches(true);
    try {
      // Extract owner and repo from URL
      const match = url.match(/github\.com\/([^\/]+)\/([^\/\.]+)/);
      if (!match) {
        debugLog('fetchBranches() - Invalid GitHub URL format');
        throw new Error('Invalid GitHub URL');
      }

      const [, owner, repo] = match;
      debugLog('fetchBranches() - Parsed repo:', { owner, repo });

      // Fetch ALL branches using pagination (GitHub API returns max 100 per page)
      let allBranches: any[] = [];
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        const apiUrl = `https://api.github.com/repos/${owner}/${repo}/branches?per_page=100&page=${page}`;
        debugLog('fetchBranches() - Fetching page', page, 'from GitHub API:', apiUrl);

        const response = await fetch(apiUrl, {
          headers: {
            'Authorization': `token ${token}`,
            'Accept': 'application/vnd.github.v3+json',
          },
        });

        debugLog('fetchBranches() - GitHub API response status:', response.status);

        if (!response.ok) {
          const errorText = await response.text();
          debugLog('fetchBranches() - GitHub API error:', { status: response.status, errorText });
          if (response.status === 401) {
            throw new Error('Invalid access token');
          }
          throw new Error(`Failed to fetch branches: ${response.status} ${errorText}`);
        }

        const branches = await response.json();
        debugLog('fetchBranches() - Page', page, 'returned', branches.length, 'branches');

        allBranches = allBranches.concat(branches);

        // Check if there are more pages
        if (branches.length < 100) {
          hasMore = false;
        } else {
          page++;
        }
      }

      const branchNames = allBranches.map((b: any) => b.name);

      debugLog('fetchBranches() - Total branches fetched:', branchNames.length);
      debugLog('fetchBranches() - All branches:', branchNames);
      setAvailableBranches(branchNames);

      // Set default branch (prefer main, then master, then first available)
      let defaultBranch = 'main';
      if (branchNames.includes('main')) {
        defaultBranch = 'main';
      } else if (branchNames.includes('master')) {
        defaultBranch = 'master';
      } else if (branchNames.length > 0) {
        defaultBranch = branchNames[0];
      }

      debugLog('fetchBranches() - Selected default branch:', defaultBranch);
      setSelectedBranch(defaultBranch);
      return defaultBranch;
    } catch (err) {
      console.error('Error fetching branches:', err);
      debugLog('fetchBranches() - Error, using fallback branches');
      // Fallback to default branches if fetch fails
      setAvailableBranches(['main', 'master', 'develop']);
      setSelectedBranch('main');
      return 'main';
    } finally {
      setLoadingBranches(false);
    }
  };

  const handleConnect = async () => {
    debugLog('handleConnect() called', { projectId, repoUrl, hasToken: !!accessToken });

    if (!repoUrl || !accessToken) {
      debugLog('handleConnect() - Missing required fields');
      setError('Please provide repository URL and access token');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // First, fetch available branches
      debugLog('handleConnect() - Step 1: Fetching branches');
      const defaultBranch = await fetchBranches(repoUrl, accessToken);
      debugLog('handleConnect() - Step 1 complete, default branch:', defaultBranch);

      // Then connect with the default branch
      debugLog('handleConnect() - Step 2: Calling /api/git');
      const requestBody = {
        operation: 'connect',
        projectId,
        repoUrl,
        accessToken,
        branch: defaultBranch,
      };
      debugLog('handleConnect() - Request body:', { ...requestBody, accessToken: '***' });

      const response = await fetch('/api/git', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      debugLog('handleConnect() - API response status:', response.status);

      const data = await response.json();
      debugLog('handleConnect() - API response data:', data);

      if (!response.ok) {
        debugLog('handleConnect() - API error:', data);
        throw new Error(data.error || 'Failed to connect repository');
      }

      debugLog('handleConnect() - Connection successful, setting repository state');
      setRepository({
        repositoryId: data.repositoryId,
        repoUrl,
        branch: data.branch,
        syncStatus: 'pending',
      });

      setSuccess('Repository connected successfully! Initial sync in progress...');
      setAccessToken(''); // Clear token for security
      debugLog('handleConnect() - Token cleared for security');

      if (onConnected) {
        debugLog('handleConnect() - Calling onConnected callback');
        onConnected(data.repositoryId);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to connect repository';
      debugLog('handleConnect() - Error:', err);
      console.error('Git integration error:', err);
      setError(errorMessage);
    } finally {
      setLoading(false);
      debugLog('handleConnect() - Complete');
    }
  };

  const handleSync = async () => {
    debugLog('handleSync() called', { repositoryId: repository?.repositoryId });

    if (!repository?.repositoryId) {
      debugLog('handleSync() - No repository connected');
      setError('No repository connected');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      debugLog('handleSync() - Calling /api/git with sync operation');
      const requestBody = {
        operation: 'sync',
        repositoryId: repository.repositoryId,
      };
      debugLog('handleSync() - Request body:', requestBody);

      const response = await fetch('/api/git', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      debugLog('handleSync() - API response status:', response.status);

      const data = await response.json();
      debugLog('handleSync() - API response data:', data);

      if (!response.ok) {
        debugLog('handleSync() - API error:', data);
        throw new Error(data.error || 'Failed to sync repository');
      }

      debugLog('handleSync() - Sync successful, updating repository state');
      setRepository({
        ...repository,
        syncStatus: 'synced',
        lastSyncedAt: new Date().toISOString(),
        lastCommitHash: data.commitHash,
      });

      setSuccess('Repository synced successfully!');
      debugLog('handleSync() - Complete');

      // Trigger code analysis after successful sync
      if (onSyncComplete && data.snapshotId) {
        debugLog('handleSync() - Triggering code analysis');
        onSyncComplete(data.snapshotId, repository.repositoryId);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to sync repository';
      debugLog('handleSync() - Error:', err);
      console.error('Sync error:', err);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleBranchChange = async (newBranch: string) => {
    if (!repository?.repositoryId) {
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Update branch in database and trigger sync with new branch
      const response = await fetch('/api/git', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          operation: 'changeBranch',
          repositoryId: repository.repositoryId,
          branch: newBranch,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to change branch');
      }

      setRepository({
        ...repository,
        branch: newBranch,
        syncStatus: 'syncing',
      });

      setSelectedBranch(newBranch);
      setSuccess(`Switched to branch '${newBranch}' and syncing...`);

      // Trigger sync after branch change
      await handleSync();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change branch');
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!repository?.repositoryId) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/git', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          operation: 'disconnect',
          repositoryId: repository.repositoryId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to disconnect repository');
      }

      setRepository(null);
      setAvailableBranches([]);
      setSelectedBranch('');
      setSuccess('Repository disconnected successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disconnect repository');
    } finally {
      setLoading(false);
    }
  };

  const getSyncStatusColor = (status?: string) => {
    switch (status) {
      case 'synced':
        return 'success';
      case 'syncing':
        return 'info';
      case 'failed':
        return 'error';
      default:
        return 'default';
    }
  };

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <GitHub sx={{ mr: 1 }} />
          <Typography variant="h6">Git Repository Integration</Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {success && (
          <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
            {success}
          </Alert>
        )}

        {!repository ? (
          <Stack spacing={2}>
            <TextField
              label="Repository URL"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              placeholder="https://github.com/owner/repo"
              fullWidth
              helperText="Enter the GitHub repository URL"
            />

            <TextField
              label="GitHub Access Token"
              type="password"
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              placeholder="ghp_xxxxxxxxxxxx"
              fullWidth
              helperText="Personal access token with repo access. Will be used to fetch available branches."
            />

            <Button
              variant="contained"
              startIcon={loading ? <CircularProgress size={20} /> : <LinkIcon />}
              onClick={handleConnect}
              disabled={loading || !repoUrl || !accessToken}
              fullWidth
            >
              {loading ? (loadingBranches ? 'Fetching branches...' : 'Connecting...') : 'Connect Repository'}
            </Button>

            <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
              💡 Branch will be auto-detected. You can change it after connecting.
            </Typography>
          </Stack>
        ) : (
          <Stack spacing={2}>
            <Box>
              <Typography variant="body2" color="text.secondary">
                Repository URL
              </Typography>
              <Typography variant="body1">{repository.repoUrl}</Typography>
            </Box>

            <FormControl fullWidth>
              <InputLabel>Branch</InputLabel>
              <Select
                value={selectedBranch || repository.branch}
                label="Branch"
                onChange={(e) => handleBranchChange(e.target.value)}
                disabled={loading || availableBranches.length === 0}
                startAdornment={<SwapHoriz sx={{ mr: 1, color: 'action.active' }} />}
              >
                {availableBranches.map((branch) => (
                  <MenuItem key={branch} value={branch}>
                    {branch}
                    {branch === repository.branch && ' (current)'}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Box>
              <Typography variant="body2" color="text.secondary">
                Status
              </Typography>
              <Chip
                label={repository.syncStatus || 'Unknown'}
                color={getSyncStatusColor(repository.syncStatus)}
                size="small"
              />
            </Box>

            {repository.lastSyncedAt && (
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Last Synced
                </Typography>
                <Typography variant="body1">
                  {new Date(repository.lastSyncedAt).toLocaleString()}
                </Typography>
              </Box>
            )}

            {repository.lastCommitHash && (
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Last Commit
                </Typography>
                <Typography variant="body1" sx={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>
                  {repository.lastCommitHash.substring(0, 8)}
                </Typography>
              </Box>
            )}

            <Stack direction="row" spacing={2}>
              <Button
                variant="contained"
                startIcon={loading ? <CircularProgress size={20} /> : <Sync />}
                onClick={handleSync}
                disabled={loading}
                fullWidth
              >
                {loading ? 'Syncing...' : 'Sync Now'}
              </Button>

              <Button
                variant="outlined"
                color="error"
                startIcon={<LinkOff />}
                onClick={handleDisconnect}
                disabled={loading}
                fullWidth
              >
                Disconnect
              </Button>
            </Stack>
          </Stack>
        )}

        <Box sx={{ mt: 2, p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
          <Typography variant="caption" color="text.secondary">
            💡 <strong>How to get a GitHub token:</strong><br />
            1. Go to GitHub Settings → Developer settings → Personal access tokens<br />
            2. Generate new token (classic) with &apos;repo&apos; scope<br />
            3. Copy and paste the token here (it will be encrypted)
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
}
