import fs from 'fs';
import path from 'path';
import { scrapeBlocksInputSchema, scrapeBlocksOutputSchema } from '../../schemas/blocks.schema';
import { z } from 'zod';


function getBlockNamesFromFile(): string[] {
  const blocksJsonPath = path.join(__dirname, 'blocks.json');
  const content = fs.readFileSync(blocksJsonPath, 'utf8');
  return JSON.parse(content);
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function scrapeBlocks({ registryUrl, style }: z.infer<typeof scrapeBlocksInputSchema>): Promise<z.infer<typeof scrapeBlocksOutputSchema>> {
  const blockNames = getBlockNamesFromFile();
  const foundBlocks: any[] = [];
  const url = `${registryUrl.replace(/\/$/, '')}/styles/${style}`;

  for (const name of blockNames) {
    try {
      const res = await fetch(`${url}/${name}.json`);
      if (!res.ok) {
        continue;
      }
      const json = await res.json();
      if (json.type === 'registry:block' && json.name) {
        foundBlocks.push(json);
      }
    } catch (e) {
      // Ignore errors for individual files
    }
    await sleep(100);
  }
  const output = {
    content: [{
      type: 'text',
      text: `Blocks in the registry (style: ${style}):\n${foundBlocks.map(b => `- ${b.name}${b.description ? `: ${b.description}` : ''}`).join('\n')}`
    }],
    structuredContent: foundBlocks
  };
  // Validate output
  return scrapeBlocksOutputSchema.parse(output);
}