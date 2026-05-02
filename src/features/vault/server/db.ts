/** DynamoDB vault persistence — read/write versioned vault payloads from eg_profiles. */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { VaultDbPayloadSchema } from './schema';
import type { VaultEntry } from '../types';

// ─── Lazy singleton ────────────────────────────────────────────────────────

let _docClient: DynamoDBDocumentClient | null = null;

function getClient(): DynamoDBDocumentClient {
  if (!_docClient) {
    const region = import.meta.env.PUBLIC_COGNITO_REGION ?? 'us-east-2';
    const raw = new DynamoDBClient({ region });
    _docClient = DynamoDBDocumentClient.from(raw, {
      marshallOptions: { removeUndefinedValues: true },
    });
  }
  return _docClient;
}

function tableName(): string {
  return import.meta.env.DYNAMO_PROFILES_TABLE ?? 'eg_profiles';
}

// ─── Read vault ────────────────────────────────────────────────────────────

export interface VaultReadResult {
  compare: VaultEntry[];
  builds: unknown[];
  rev: number;
}

/**
 * Read a user's vault from DynamoDB.
 * Returns empty compare + builds + rev 0 if no record exists or data is invalid.
 */
export async function readVault(uid: string): Promise<VaultReadResult> {
  const client = getClient();
  const result = await client.send(new GetCommand({
    TableName: tableName(),
    Key: { userId: uid },
    ProjectionExpression: 'vault, rev',
  }));

  const rev = typeof result.Item?.rev === 'number' ? result.Item.rev : 0;

  if (!result.Item?.vault) {
    return { compare: [], builds: [], rev };
  }

  // WHY graceful parse: legacy data, missing 'v' field, or corrupt JSON all → empty
  try {
    const raw = typeof result.Item.vault === 'string'
      ? JSON.parse(result.Item.vault)
      : result.Item.vault;

    // Treat missing 'v' as v1
    const withVersion = raw.v ? raw : { ...raw, v: 1 };
    const parsed = VaultDbPayloadSchema.safeParse(withVersion);

    if (parsed.success) {
      return { compare: parsed.data.compare, builds: parsed.data.builds, rev };
    }
  } catch {
    // Invalid JSON — fall through to empty
  }

  return { compare: [], builds: [], rev };
}

// ─── Write vault ───────────────────────────────────────────────────────────

/**
 * Write compare + builds to DynamoDB with atomic rev increment.
 * Returns the new rev number.
 */
export async function writeVault(
  uid: string,
  compare: VaultEntry[],
  builds: unknown[],
): Promise<number> {
  const client = getClient();
  const payload = JSON.stringify({ v: 1, compare, builds });

  const result = await client.send(new UpdateCommand({
    TableName: tableName(),
    Key: { userId: uid },
    UpdateExpression: 'SET vault = :v ADD rev :inc',
    ExpressionAttributeValues: {
      ':v': payload,
      ':inc': 1,
    },
    ReturnValues: 'UPDATED_NEW',
  }));

  return typeof result.Attributes?.rev === 'number' ? result.Attributes.rev : 1;
}

// ─── Read rev only ─────────────────────────────────────────────────────────

/**
 * Read only the rev counter for a user.
 * Returns 0 if no record exists (used for first-signup detection).
 */
export async function readVaultRev(uid: string): Promise<number> {
  const client = getClient();
  const result = await client.send(new GetCommand({
    TableName: tableName(),
    Key: { userId: uid },
    ProjectionExpression: 'rev',
  }));

  return typeof result.Item?.rev === 'number' ? result.Item.rev : 0;
}
