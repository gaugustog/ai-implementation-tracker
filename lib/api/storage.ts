import { uploadData, downloadData, remove, list } from 'aws-amplify/storage';

// Upload a markdown file to S3
export const uploadMarkdownFile = async (
  path: string,
  content: string,
  metadata?: Record<string, string>
): Promise<string> => {
  try {
    const blob = new Blob([content], { type: 'text/markdown' });
    const result = await uploadData({
      path,
      data: blob,
      options: {
        contentType: 'text/markdown',
        metadata,
      },
    }).result;

    return result.path;
  } catch (error) {
    console.error('Error uploading file:', error);
    throw error;
  }
};

// Download a markdown file from S3
export const downloadMarkdownFile = async (path: string): Promise<string> => {
  try {
    const result = await downloadData({
      path,
    }).result;

    const blob = await result.body.blob();
    const text = await blob.text();
    return text;
  } catch (error) {
    console.error('Error downloading file:', error);
    throw error;
  }
};

// Delete a file from S3
export const deleteFile = async (path: string): Promise<void> => {
  try {
    await remove({ path });
  } catch (error) {
    console.error('Error deleting file:', error);
    throw error;
  }
};

// List files in a directory
export const listFiles = async (prefix: string) => {
  try {
    const result = await list({
      path: prefix,
    });
    return result.items;
  } catch (error) {
    console.error('Error listing files:', error);
    throw error;
  }
};

// Helper to generate a unique file path
export const generateFilePath = (
  type: 'specs' | 'tickets',
  filename: string
): string => {
  const timestamp = Date.now();
  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
  return `${type}/${timestamp}_${sanitizedFilename}`;
};
