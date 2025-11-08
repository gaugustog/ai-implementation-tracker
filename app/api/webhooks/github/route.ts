import { NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'crypto';

const WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET || '';
const GIT_INTEGRATION_URL = process.env.GIT_INTEGRATION_URL || '';

/**
 * GitHub webhook handler
 * Handles push events and triggers repository sync
 */
export async function POST(request: NextRequest) {
  try {
    // Get headers
    const signature = request.headers.get('x-hub-signature-256');
    const event = request.headers.get('x-github-event');
    const delivery = request.headers.get('x-github-delivery');

    console.log('GitHub webhook received:', { event, delivery });

    // Get raw body for signature validation
    const body = await request.text();

    // Validate webhook signature
    if (WEBHOOK_SECRET && signature) {
      const isValid = validateSignature(body, signature, WEBHOOK_SECRET);
      if (!isValid) {
        console.error('Invalid webhook signature');
        return NextResponse.json(
          { error: 'Invalid signature' },
          { status: 401 }
        );
      }
    }

    // Parse body
    const payload = JSON.parse(body);

    // Handle different event types
    switch (event) {
      case 'push':
        return await handlePushEvent(payload);
      
      case 'pull_request':
        return await handlePullRequestEvent(payload);
      
      case 'ping':
        return NextResponse.json({ message: 'pong' });
      
      default:
        console.log(`Unhandled event type: ${event}`);
        return NextResponse.json({ message: 'Event received' });
    }
  } catch (error) {
    console.error('Error processing webhook:', error);
    return NextResponse.json(
      {
        error: 'Failed to process webhook',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Hub-Signature-256, X-GitHub-Event',
    },
  });
}

/**
 * Handle push events - trigger repository sync
 */
async function handlePushEvent(payload: any) {
  const repoFullName = payload.repository?.full_name;
  const branch = payload.ref?.replace('refs/heads/', '');
  const commitSha = payload.after;

  console.log('Push event:', { repoFullName, branch, commitSha });

  // In a real implementation, you would:
  // 1. Find the repository record in DynamoDB by repoUrl
  // 2. Trigger a sync operation via the git-integration Lambda

  if (!GIT_INTEGRATION_URL) {
    console.log('No Git Integration URL configured, skipping sync');
    return NextResponse.json({ message: 'Webhook received (no action)' });
  }

  // Trigger sync (this would need the repository ID)
  // For now, just acknowledge the webhook
  return NextResponse.json({
    message: 'Push event processed',
    repoFullName,
    branch,
    commitSha,
  });
}

/**
 * Handle pull request events
 */
async function handlePullRequestEvent(payload: any) {
  const action = payload.action;
  const prNumber = payload.pull_request?.number;
  const repoFullName = payload.repository?.full_name;

  console.log('Pull request event:', { action, prNumber, repoFullName });

  // Could analyze PR changes and provide context
  return NextResponse.json({
    message: 'Pull request event processed',
    action,
    prNumber,
  });
}

/**
 * Validate GitHub webhook signature
 */
function validateSignature(payload: string, signature: string, secret: string): boolean {
  const hmac = createHmac('sha256', secret);
  const digest = 'sha256=' + hmac.update(payload).digest('hex');
  return signature === digest;
}
