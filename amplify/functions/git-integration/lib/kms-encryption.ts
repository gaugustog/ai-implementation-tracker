import { KMSClient, EncryptCommand, DecryptCommand } from '@aws-sdk/client-kms';

export class KMSEncryption {
  private client: KMSClient;
  private keyId: string;

  constructor(keyId: string) {
    this.keyId = keyId;
    this.client = new KMSClient({
      region: process.env.AWS_REGION || 'us-east-1',
    });
  }

  /**
   * Encrypt plaintext using KMS
   */
  async encrypt(plaintext: string): Promise<string> {
    try {
      console.log('Encrypting credential with KMS...');

      const command = new EncryptCommand({
        KeyId: this.keyId,
        Plaintext: Buffer.from(plaintext, 'utf-8'),
      });

      const response = await this.client.send(command);

      if (!response.CiphertextBlob) {
        throw new Error('KMS encryption returned no ciphertext');
      }

      // Convert to base64 for storage
      const encrypted = Buffer.from(response.CiphertextBlob).toString('base64');
      console.log('✅ Credential encrypted successfully');

      return encrypted;
    } catch (error: any) {
      console.error('❌ KMS encryption failed:', error);
      throw new Error(`Failed to encrypt credential: ${error.message}`);
    }
  }

  /**
   * Decrypt ciphertext using KMS
   */
  async decrypt(ciphertext: string): Promise<string> {
    try {
      console.log('Decrypting credential with KMS...');

      // Convert from base64
      const ciphertextBlob = Buffer.from(ciphertext, 'base64');

      const command = new DecryptCommand({
        CiphertextBlob: ciphertextBlob,
        KeyId: this.keyId,
      });

      const response = await this.client.send(command);

      if (!response.Plaintext) {
        throw new Error('KMS decryption returned no plaintext');
      }

      const decrypted = Buffer.from(response.Plaintext).toString('utf-8');
      console.log('✅ Credential decrypted successfully');

      return decrypted;
    } catch (error: any) {
      console.error('❌ KMS decryption failed:', error);
      throw new Error(`Failed to decrypt credential: ${error.message}`);
    }
  }
}
