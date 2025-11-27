import Groq from 'groq-sdk';

const client = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

console.log('Testing Groq client...');
console.log('Messages property exists:', !!client.messages);
console.log('Messages.create exists:', !!(client.messages && client.messages.create));

// List what we have
console.log('\nClient structure:');
for (const key of Object.keys(client)) {
  console.log(`  ${key}: ${typeof client[key]}`);
}
