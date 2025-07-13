import { Blocks } from "./blocks";
// Pure function to return the list of blocks from blocks.json
export async function getBlocks() {
  // Return as array of objects matching blockSchema
  return Blocks.map((name: string) => ({
    name,
    type: 'registry:block',
    // description: undefined // can be omitted
  }));
} 