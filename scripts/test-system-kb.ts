/**
 * Test System Knowledge Base Retrieval
 *
 * Tests that we can query Trevor's book from the vector store.
 *
 * Usage:
 *   OPENAI_API_KEY="sk-..." npx tsx scripts/test-system-kb.ts
 */

import OpenAI from 'openai';

const SYSTEM_KB_VECTOR_STORE_ID = 'vs_6948707b318c81918a90e9b44970a99e';

async function testSystemKB(): Promise<void> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    console.error('ERROR: OPENAI_API_KEY environment variable is required');
    process.exit(1);
  }

  const client = new OpenAI({ apiKey });

  console.log('=== Testing System KB Retrieval ===\n');
  console.log(`Vector Store ID: ${SYSTEM_KB_VECTOR_STORE_ID}\n`);

  // Test queries
  const testQueries = [
    "What is the IDEA framework?",
    "How do I build an emotional connection with customers?",
    "What makes a brand authentic?",
  ];

  for (const query of testQueries) {
    console.log(`\n--- Query: "${query}" ---\n`);

    try {
      // Use the Responses API with file_search tool
      const response = await client.responses.create({
        model: 'gpt-4o-mini',
        input: query,
        tools: [{
          type: 'file_search',
          vector_store_ids: [SYSTEM_KB_VECTOR_STORE_ID],
        }],
      });

      console.log('Response:', response.output_text?.substring(0, 500) + '...');

      // Check if file search was used
      if (response.output && Array.isArray(response.output)) {
        for (const item of response.output) {
          if (item.type === 'file_search_call') {
            console.log('\nFile search results found!');
            console.log('Results:', JSON.stringify(item, null, 2).substring(0, 1000));
          }
        }
      }

    } catch (error: any) {
      console.error('Error:', error.message);

      // If Responses API doesn't work, try Assistants API approach
      if (error.message?.includes('responses')) {
        console.log('\nTrying alternative approach with Chat Completions + manual search...');
        await testWithManualSearch(client, query);
      }
    }
  }

  console.log('\n=== Test Complete ===');
}

async function testWithManualSearch(client: OpenAI, query: string): Promise<void> {
  try {
    // First, search the vector store directly
    console.log('Searching vector store...');

    // Create a temporary assistant to search
    const assistant = await client.beta.assistants.create({
      name: 'System KB Test',
      model: 'gpt-4o-mini',
      tools: [{ type: 'file_search' }],
      tool_resources: {
        file_search: {
          vector_store_ids: [SYSTEM_KB_VECTOR_STORE_ID],
        },
      },
    });

    console.log('Created test assistant:', assistant.id);

    // Create a thread and run
    const thread = await client.beta.threads.create();

    await client.beta.threads.messages.create(thread.id, {
      role: 'user',
      content: query,
    });

    const run = await client.beta.threads.runs.createAndPoll(thread.id, {
      assistant_id: assistant.id,
    });

    if (run.status === 'completed') {
      const messages = await client.beta.threads.messages.list(thread.id);
      const lastMessage = messages.data[0];

      if (lastMessage.content[0].type === 'text') {
        console.log('\nAssistant Response:');
        console.log(lastMessage.content[0].text.value.substring(0, 800) + '...');

        // Check for citations
        if (lastMessage.content[0].text.annotations) {
          console.log('\nCitations found:', lastMessage.content[0].text.annotations.length);
        }
      }
    } else {
      console.log('Run status:', run.status);
    }

    // Cleanup
    await client.beta.assistants.del(assistant.id);
    console.log('Cleaned up test assistant');

  } catch (error: any) {
    console.error('Manual search error:', error.message);
  }
}

// Run the test
testSystemKB();
