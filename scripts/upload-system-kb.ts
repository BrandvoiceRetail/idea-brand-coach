/**
 * Upload System Knowledge Base to OpenAI Vector Store
 *
 * This script uploads Trevor's book PDF to create the System KB
 * that will be shared across all users.
 *
 * Usage:
 *   OPENAI_API_KEY="sk-..." npx tsx scripts/upload-system-kb.ts
 *
 * Or set OPENAI_API_KEY in your environment.
 */

import OpenAI from 'openai';
import * as fs from 'fs';
import * as path from 'path';

const BOOK_PATH = path.join(
  process.env.HOME || '~',
  'Downloads',
  'What Captures The Heart Goes In The Cart AI App copy.pdf'
);

const VECTOR_STORE_NAME = 'IDEA System Knowledge Base';

async function uploadSystemKB(): Promise<void> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    console.error('ERROR: OPENAI_API_KEY environment variable is required');
    console.error('Usage: OPENAI_API_KEY="sk-..." npx tsx scripts/upload-system-kb.ts');
    process.exit(1);
  }

  // Verify file exists
  if (!fs.existsSync(BOOK_PATH)) {
    console.error(`ERROR: Book PDF not found at: ${BOOK_PATH}`);
    process.exit(1);
  }

  const fileStats = fs.statSync(BOOK_PATH);
  console.log(`Found book PDF: ${BOOK_PATH}`);
  console.log(`File size: ${(fileStats.size / 1024 / 1024).toFixed(2)} MB`);

  const client = new OpenAI({ apiKey });

  try {
    // Step 1: Upload the file
    console.log('\n--- Step 1: Uploading PDF to OpenAI ---');
    const file = await client.files.create({
      file: fs.createReadStream(BOOK_PATH),
      purpose: 'assistants',
    });
    console.log(`File uploaded successfully!`);
    console.log(`  File ID: ${file.id}`);
    console.log(`  Filename: ${file.filename}`);
    console.log(`  Status: ${file.status}`);

    // Step 2: Create vector store
    console.log('\n--- Step 2: Creating Vector Store ---');
    const vectorStore = await client.beta.vectorStores.create({
      name: VECTOR_STORE_NAME,
    });
    console.log(`Vector store created: ${vectorStore.id}`);

    // Step 2b: Add file to vector store
    console.log('\n--- Step 2b: Adding file to Vector Store ---');
    await client.beta.vectorStores.files.create(vectorStore.id, {
      file_id: file.id,
    });
    console.log(`Vector store created!`);
    console.log(`  Vector Store ID: ${vectorStore.id}`);
    console.log(`  Name: ${vectorStore.name}`);
    console.log(`  Status: ${vectorStore.status}`);

    // Step 3: Wait for processing
    console.log('\n--- Step 3: Waiting for file processing ---');
    let status = vectorStore.status;
    let attempts = 0;
    const maxAttempts = 60; // 5 minutes max

    while (status === 'in_progress' && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
      const updated = await client.beta.vectorStores.retrieve(vectorStore.id);
      status = updated.status;
      attempts++;
      console.log(`  Processing... (attempt ${attempts}/${maxAttempts}, status: ${status})`);

      if (updated.file_counts) {
        console.log(`  Files: ${updated.file_counts.completed}/${updated.file_counts.total} completed`);
      }
    }

    // Get final status
    const finalStore = await client.beta.vectorStores.retrieve(vectorStore.id);

    if (finalStore.status === 'completed') {
      console.log('\n=== SUCCESS ===');
      console.log(`Vector Store is ready!`);
      console.log(`\n  VECTOR_STORE_ID: ${vectorStore.id}`);
      console.log(`\nNext steps:`);
      console.log(`1. Add this to Supabase secrets:`);
      console.log(`   npx supabase secrets set SYSTEM_KB_VECTOR_STORE_ID="${vectorStore.id}"`);
      console.log(`\n2. Or add to .env.local for local development:`);
      console.log(`   SYSTEM_KB_VECTOR_STORE_ID=${vectorStore.id}`);
    } else {
      console.log('\n=== WARNING ===');
      console.log(`Vector Store status: ${finalStore.status}`);
      console.log(`File counts:`, finalStore.file_counts);
      console.log(`\nThe vector store may still be processing. Check OpenAI dashboard.`);
      console.log(`Vector Store ID: ${vectorStore.id}`);
    }

    // List files in vector store for verification
    console.log('\n--- Vector Store Files ---');
    const files = await client.beta.vectorStores.files.list(vectorStore.id);
    for (const f of files.data) {
      console.log(`  - ${f.id}: ${f.status}`);
    }

  } catch (error) {
    console.error('\nERROR:', error);
    process.exit(1);
  }
}

// Run the script
uploadSystemKB();
