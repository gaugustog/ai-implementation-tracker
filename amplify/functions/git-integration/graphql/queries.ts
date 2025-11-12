export const GET_GIT_REPOSITORY = `
  query GetGitRepository($id: ID!) {
    getGitRepository(id: $id) {
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

export const GET_GIT_CREDENTIAL = `
  query GetGitCredential($repositoryId: ID!) {
    listGitCredentials(filter: { repositoryId: { eq: $repositoryId } }) {
      items {
        id
        repositoryId
        type
        encryptedToken
        username
        createdAt
        updatedAt
      }
    }
  }
`;
