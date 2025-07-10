import * as path from 'path';
import * as fs from 'fs';

// Pure function to return the list of blocks from blocks.json
export async function getBlocks() {
  const blocksPath = path.join(process.cwd(), 'src/mcp/handlers/blocks.json');
  const content = fs.readFileSync(blocksPath, 'utf8');
  const blocks = JSON.parse(content);
  // Return as array of objects matching blockSchema
  return blocks.map((name: string) => ({
    name,
    type: 'registry:block',
    // description: undefined // can be omitted
  }));
} 