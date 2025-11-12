export const CREATE_GIT_REPOSITORY = `
  mutation CreateGitRepository($input: CreateGitRepositoryInput!) {
    createGitRepository(input: $input) {
      id
      projectId
      provider
      repoUrl
      currentBranch
      branches
      status
      lastSyncedAt
      createdAt
      updatedAt
    }
  }
`;

export const UPDATE_GIT_REPOSITORY = `
  mutation UpdateGitRepository($input: UpdateGitRepositoryInput!) {
    updateGitRepository(input: $input) {
      id
      currentBranch
      branches
      status
      lastSyncedAt
      updatedAt
    }
  }
`;

export const CREATE_GIT_CREDENTIAL = `
  mutation CreateGitCredential($input: CreateGitCredentialInput!) {
    createGitCredential(input: $input) {
      id
      repositoryId
      type
      encryptedToken
      username
      createdAt
      updatedAt
    }
  }
`;

export const UPDATE_GIT_CREDENTIAL = `
  mutation UpdateGitCredential($input: UpdateGitCredentialInput!) {
    updateGitCredential(input: $input) {
      id
      repositoryId
      encryptedToken
      username
      updatedAt
    }
  }
`;
