import type { GitProvider } from '../types';
import type { IGitProvider } from './base';
import { GitHubProvider } from './github';
import { GitLabProvider } from './gitlab';
import { BitbucketProvider } from './bitbucket';

export class GitProviderFactory {
  static create(provider: GitProvider): IGitProvider {
    switch (provider) {
      case 'github':
        return new GitHubProvider();

      case 'gitlab':
        return new GitLabProvider();

      case 'bitbucket':
        return new BitbucketProvider();

      default:
        throw new Error(`Unsupported Git provider: ${provider}`);
    }
  }
}
