import fs from 'fs/promises';
import path from 'path';
import Markdoc from '@markdoc/markdoc';
import { config } from './config.js';

function extractFrontmatter(content) {
  const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n/;
  const match = content.match(frontmatterRegex);
  
  if (!match) {
    return { frontmatter: {}, content };
  }
  
  const frontmatterString = match[1];
  const contentWithoutFrontmatter = content.slice(match[0].length);
  
  // Parse frontmatter
  const frontmatter = {};
  frontmatterString.split('\n').forEach(line => {
    const colonIndex = line.indexOf(':');
    if (colonIndex > 0) {
      const key = line.slice(0, colonIndex).trim();
      let value = line.slice(colonIndex + 1).trim();
      
      // Handle arrays (categories)
      if (value.startsWith('[') || line.trim() === `${key}:`) {
        const lines = [line];
        const arrayMatch = frontmatterString.match(new RegExp(`${key}:\\s*\\n((?:\\s+-\\s+.*\\n?)+)`));
        if (arrayMatch) {
          value = arrayMatch[1]
            .split('\n')
            .filter(l => l.trim())
            .map(l => l.replace(/^\s*-\s*/, '').trim());
        }
      } else {
        // Remove quotes if present
        value = value.replace(/^["']|["']$/g, '');
      }
      
      frontmatter[key] = value;
    }
  });
  
  return { frontmatter, content: contentWithoutFrontmatter };
}

function transformMarkdocToJS(content, frontmatter, filename) {
  // Process math expressions
  content = transformMathExpressions(content);
  
  // Process mermaid blocks to preserve content
  content = transformMermaidBlocks(content);
  
  // Parse and transform Markdoc
  const ast = Markdoc.parse(content);
  const renderable = Markdoc.transform(ast, config);
  
  // Generate module code
  return `
import MarkdocRenderer from '$lib/markdoc/renderer.svelte';

export const metadata = ${JSON.stringify(frontmatter)};

export default {
  render: () => ({
    component: MarkdocRenderer,
    props: { children: ${JSON.stringify(renderable.children || renderable)} }
  })
};
`;
}

function transformMathExpressions(content) {
  // Transform block math ($$...$$)
  content = content.replace(/\$\$([\s\S]*?)\$\$/g, (match, math) => {
    return `{% math type="block" %}${math.trim()}{% /math %}`;
  });
  
  // Transform inline math ($...$)
  // Be careful not to match escaped dollars or double dollars
  content = content.replace(/(?<!\\)\$(?!\$)(.*?)(?<!\\)\$(?!\$)/g, (match, math) => {
    return `{% math type="inline" %}${math.trim()}{% /math %}`;
  });
  
  return content;
}

function transformMermaidBlocks(content) {
  // Transform mermaid blocks to preserve their content with proper escaping
  content = content.replace(/{% mermaid(.*?)%}([\s\S]*?){% \/mermaid %}/g, (match, attrs, mermaidContent) => {
    // Escape the content to preserve it through Markdoc parsing
    const encodedContent = Buffer.from(mermaidContent.trim()).toString('base64');
    return `{% mermaid${attrs} encodedContent="${encodedContent}" /%}`;
  });
  
  return content;
}

export function markdocPlugin() {
  return {
    name: 'vite-plugin-markdoc',
    
    async transform(src, id) {
      if (!id.endsWith('.md')) return null;
      
      try {
        const { frontmatter, content } = extractFrontmatter(src);
        const filename = path.basename(id, '.md');
        const transformed = transformMarkdocToJS(content, frontmatter, filename);
        
        return {
          code: transformed,
          map: null
        };
      } catch (error) {
        this.error(`Error processing Markdoc file ${id}: ${error.message}`);
      }
    },
    
    handleHotUpdate({ file, server }) {
      if (file.endsWith('.md')) {
        // Trigger full reload for markdown changes
        server.ws.send({
          type: 'full-reload',
          path: '*'
        });
      }
    }
  };
}