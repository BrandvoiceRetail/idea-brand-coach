/**
 * Upload Skills to OpenAI Vector Store
 *
 * One-time script to create an OpenAI vector store and upload all 19 IDEA
 * Brand Coach skill files. Run with:
 *
 *   deno run --allow-read --allow-net --allow-env scripts/upload-skills-to-vector-store.ts
 *
 * Or with an explicit API key:
 *
 *   OPENAI_API_KEY=sk-... deno run --allow-read --allow-net --allow-env scripts/upload-skills-to-vector-store.ts
 *
 * After running, add the output vector store ID to supabase/functions/.env:
 *   SKILLS_VECTOR_STORE_ID=vs_xxxxxxxxxxxxx
 */

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
if (!OPENAI_API_KEY) {
  console.error("Error: OPENAI_API_KEY environment variable is required");
  Deno.exit(1);
}

const SKILLS_DIR = new URL("../skills/", import.meta.url).pathname;
const VECTOR_STORE_NAME = "idea-brand-coach-skills-v1";

interface VectorStoreFile {
  id: string;
  status: string;
}

async function createVectorStore(): Promise<string> {
  console.log(`Creating vector store: ${VECTOR_STORE_NAME}`);

  const response = await fetch("https://api.openai.com/v1/vector_stores", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
      "OpenAI-Beta": "assistants=v2",
    },
    body: JSON.stringify({ name: VECTOR_STORE_NAME }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create vector store: ${response.status} ${error}`);
  }

  const data = await response.json();
  console.log(`Vector store created: ${data.id}`);
  return data.id;
}

async function uploadFile(filePath: string): Promise<string> {
  const fileName = filePath.split("/").pop()!;
  console.log(`  Uploading: ${fileName}`);

  const fileContent = await Deno.readFile(filePath);
  const formData = new FormData();
  formData.append("purpose", "assistants");
  formData.append("file", new Blob([fileContent], { type: "text/markdown" }), fileName);

  const response = await fetch("https://api.openai.com/v1/files", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to upload ${fileName}: ${response.status} ${error}`);
  }

  const data = await response.json();
  return data.id;
}

async function addFileToVectorStore(vectorStoreId: string, fileId: string): Promise<void> {
  const response = await fetch(
    `https://api.openai.com/v1/vector_stores/${vectorStoreId}/files`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
        "OpenAI-Beta": "assistants=v2",
      },
      body: JSON.stringify({ file_id: fileId }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to add file to vector store: ${response.status} ${error}`);
  }
}

async function waitForProcessing(vectorStoreId: string): Promise<void> {
  console.log("\nWaiting for vector store processing...");
  let attempts = 0;
  const maxAttempts = 60;

  while (attempts < maxAttempts) {
    const response = await fetch(
      `https://api.openai.com/v1/vector_stores/${vectorStoreId}`,
      {
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "OpenAI-Beta": "assistants=v2",
        },
      }
    );

    if (!response.ok) break;

    const data = await response.json();
    const counts = data.file_counts;

    if (counts.in_progress === 0) {
      console.log(`Processing complete: ${counts.completed} completed, ${counts.failed} failed`);
      return;
    }

    console.log(`  Processing: ${counts.in_progress} in progress, ${counts.completed} completed...`);
    await new Promise((r) => setTimeout(r, 2000));
    attempts++;
  }

  console.warn("Warning: Processing may not be complete. Check the OpenAI dashboard.");
}

async function main(): Promise<void> {
  console.log("=== IDEA Brand Coach Skills Vector Store Upload ===\n");

  // Get all skill files
  const skillFiles: string[] = [];
  for await (const entry of Deno.readDir(SKILLS_DIR)) {
    if (entry.isFile && entry.name.endsWith(".md")) {
      skillFiles.push(`${SKILLS_DIR}${entry.name}`);
    }
  }
  skillFiles.sort();

  console.log(`Found ${skillFiles.length} skill files\n`);

  if (skillFiles.length !== 19) {
    console.warn(`Warning: Expected 19 skill files, found ${skillFiles.length}`);
  }

  // Create vector store
  const vectorStoreId = await createVectorStore();

  // Upload each file and add to vector store
  console.log("\nUploading files:");
  for (const filePath of skillFiles) {
    const fileId = await uploadFile(filePath);
    await addFileToVectorStore(vectorStoreId, fileId);
  }

  // Wait for processing
  await waitForProcessing(vectorStoreId);

  // Output result
  console.log("\n=== COMPLETE ===");
  console.log(`\nVector Store ID: ${vectorStoreId}`);
  console.log(`\nAdd this to supabase/functions/.env:`);
  console.log(`SKILLS_VECTOR_STORE_ID=${vectorStoreId}`);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  Deno.exit(1);
});
