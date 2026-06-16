import Markdoc from '@markdoc/markdoc';

export const config = {
  nodes: {
    fence: {
      render: 'Code',
      attributes: {
        content: { type: String },
        language: { type: String },
      },
      transform(node, config) {
        const info = node.attributes.language || '';
        const parts = info.split(' ');
        const language = parts[0] || 'text';
        let filename = '';
        let highlightLines = '';
        let showLineNumbers = false;
        
        parts.slice(1).forEach(part => {
          if (part.startsWith('filename=')) {
            filename = part.substring(9).replace(/["']/g, '');
          } else if (part.match(/^\{[\d,-]+\}$/)) {
            highlightLines = part.slice(1, -1);
          } else if (part === 'showLineNumbers') {
            showLineNumbers = true;
          }
        });
        
        return {
          name: 'Code',
          attributes: {
            content: node.attributes.content || '',
            language,
            filename,
            highlightLines,
            showLineNumbers
          }
        };
      }
    },
    code: {
      render: 'Code',
      attributes: {
        content: { type: String }
      },
      transform(node, config) {
        // Get the raw content from the node
        const content = node.attributes.content || '';
        
        return {
          name: 'Code',
          attributes: {
            content,
            inline: true
          }
        };
      }
    },
    heading: {
      render: true,
      children: ['inline'],
      attributes: {
        id: { type: String },
        level: { type: Number, required: true, default: 1 }
      },
      transform(node, config) {
        const attributes = node.transformAttributes(config);
        const children = node.transformChildren(config);
        
        // Generate ID from heading text if not provided
        if (!attributes.id && node.children) {
          const text = node.children
            .map(child => typeof child === 'string' ? child : '')
            .join('');
          attributes.id = text
            .toLowerCase()
            .replace(/[^\w\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .trim();
        }
        
        return {
          name: `h${attributes.level}`,
          attributes: { id: attributes.id },
          children
        };
      }
    }
  },
  tags: {
    math: {
      render: 'Math',
      children: ['text', 'softbreak', 'hardbreak', 'inline'],
      attributes: {
        type: {
          type: String,
          default: 'inline',
          matches: ['inline', 'block']
        }
      },
      transform(node, config) {
        const attributes = node.transformAttributes(config);
        
        // Extract content from children - handle various node types
        let content = '';
        if (node.children && Array.isArray(node.children)) {
          // For inline math, content is directly in the text node
          const firstChild = node.children[0];
          if (firstChild && firstChild.type === 'text' && firstChild.attributes?.content) {
            content = firstChild.attributes.content;
          } else {
            // For block math, need to traverse deeper
            content = extractTextFromNode(node.children);
          }
        }
        
        function extractTextFromNode(children) {
          return children.map(child => {
            if (typeof child === 'string') return child;
            if (child.type === 'text' && child.attributes?.content) {
              return child.attributes.content;
            }
            if (child.type === 'softbreak') return '\n';
            if (child.type === 'hardbreak') return '\n';
            if (child.children) {
              return extractTextFromNode(child.children);
            }
            return '';
          }).join('');
        }
        
        
        return {
          name: 'Math',
          attributes: {
            ...attributes,
            content: content
          }
        };
      }
    },
  }
};