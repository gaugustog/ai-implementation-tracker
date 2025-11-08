'use client';

import React, { useState } from 'react';
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
import { GitHub, Sync, Link as LinkIcon, LinkOff } from '@mui/icons-material';

interface GitIntegrationPanelProps {
  projectId: string;
  onConnected?: (repositoryId: string) => void;
}

interface RepositoryStatus {
  repositoryId?: string;
  repoUrl?: string;
  branch?: string;
  syncStatus?: 'pending' | 'syncing' | 'synced' | 'failed';
  lastSyncedAt?: string;
  lastCommitHash?: string;
}

export function GitIntegrationPanel({ projectId, onConnected }: GitIntegrationPanelProps) {
  const [repoUrl, setRepoUrl] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [branch, setBranch] = useState('main');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [repository, setRepository] = useState<RepositoryStatus | null>(null);

  const handleConnect = async () => {
    if (!repoUrl || !accessToken) {
      setError('Please provide repository URL and access token');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/git', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          operation: 'connect',
          projectId,
          repoUrl,
          accessToken,
          branch,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to connect repository');
      }

      setRepository({
        repositoryId: data.repositoryId,
        repoUrl,
        branch: data.branch,
        syncStatus: 'pending',
      });

      setSuccess('Repository connected successfully! Initial sync in progress...');
      setAccessToken(''); // Clear token for security

      if (onConnected) {
        onConnected(data.repositoryId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect repository');
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    if (!repository?.repositoryId) {
      setError('No repository connected');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/git', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          operation: 'sync',
          repositoryId: repository.repositoryId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to sync repository');
      }

      setRepository({
        ...repository,
        syncStatus: 'synced',
        lastSyncedAt: new Date().toISOString(),
        lastCommitHash: data.commitHash,
      });

      setSuccess('Repository synced successfully!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sync repository');
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
              helperText="Personal access token with repo access"
            />

            <FormControl fullWidth>
              <InputLabel>Branch</InputLabel>
              <Select
                value={branch}
                label="Branch"
                onChange={(e) => setBranch(e.target.value)}
              >
                <MenuItem value="main">main</MenuItem>
                <MenuItem value="master">master</MenuItem>
                <MenuItem value="develop">develop</MenuItem>
              </Select>
            </FormControl>

            <Button
              variant="contained"
              startIcon={loading ? <CircularProgress size={20} /> : <LinkIcon />}
              onClick={handleConnect}
              disabled={loading || !repoUrl || !accessToken}
              fullWidth
            >
              {loading ? 'Connecting...' : 'Connect Repository'}
            </Button>
          </Stack>
        ) : (
          <Stack spacing={2}>
            <Box>
              <Typography variant="body2" color="text.secondary">
                Repository URL
              </Typography>
              <Typography variant="body1">{repository.repoUrl}</Typography>
            </Box>

            <Box>
              <Typography variant="body2" color="text.secondary">
                Branch
              </Typography>
              <Typography variant="body1">{repository.branch}</Typography>
            </Box>

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
