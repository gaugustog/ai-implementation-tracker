// ============================================================================
// EVENT TYPES
// ============================================================================

export interface GitIntegrationEvent {
  arguments: {
    operation: GitOperation;
    data: any;
  };
}

export type GitOperation =
  | 'connectRepository'
  | 'listBranches'
  | 'switchBranch'
  | 'updateCredential'
  | 'validateAccess';

// ============================================================================
// RESPONSE TYPES
// ============================================================================

export interface GitIntegrationResponse {
  success: boolean;
  data?: any;
  error?: {
    message: string;
    code?: string;
    details?: any;
  };
}

// ============================================================================
// GIT PROVIDER TYPES
// ============================================================================

export type GitProvider = 'github' | 'gitlab' | 'bitbucket';

export interface GitProviderConfig {
  provider: GitProvider;
  repoUrl: string;
  token: string;
}

export interface GitBranch {
  name: string;
  commit: {
    sha: string;
    message?: string;
  };
  protected?: boolean;
}

export interface GitRepository {
  id: string;
  provider: GitProvider;
  repoUrl: string;
  currentBranch: string;
  branches?: string[];
  status: 'pending' | 'analyzing' | 'ready' | 'error';
}

export interface GitCredential {
  id: string;
  repositoryId: string;
  type: 'token' | 'ssh' | 'oauth';
  encryptedToken: string;
  username?: string;
}

// ============================================================================
// OPERATION DATA TYPES
// ============================================================================

export interface ConnectRepositoryData {
  projectId: string;
  provider: GitProvider;
  repoUrl: string;
  credentialType: 'token' | 'ssh' | 'oauth';
  token: string;
  username?: string;
}

export interface ListBranchesData {
  repositoryId: string;
}

export interface SwitchBranchData {
  repositoryId: string;
  branch: string;
}

export interface UpdateCredentialData {
  repositoryId: string;
  token: string;
  username?: string;
}

export interface ValidateAccessData {
  repositoryId: string;
}

// ============================================================================
// APPSYNC TYPES
// ============================================================================

export interface AppSyncCreateGitRepositoryInput {
  projectId: string;
  provider: GitProvider;
  repoUrl: string;
  currentBranch: string;
  status: 'pending' | 'analyzing' | 'ready' | 'error';
  branches?: string[];
  lastSyncedAt?: string;
}

export interface AppSyncUpdateGitRepositoryInput {
  id: string;
  currentBranch?: string;
  branches?: string[];
  status?: 'pending' | 'analyzing' | 'ready' | 'error';
  lastSyncedAt?: string;
}

export interface AppSyncCreateGitCredentialInput {
  repositoryId: string;
  type: 'token' | 'ssh' | 'oauth';
  encryptedToken: string;
  username?: string;
}

export interface AppSyncUpdateGitCredentialInput {
  repositoryId: string;
  encryptedToken: string;
  username?: string;
}
