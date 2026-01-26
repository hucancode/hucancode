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
    mermaid: {
      render: 'Mermaid',
      selfClosing: true,
      attributes: {
        theme: {
          type: String,
          default: 'default'
        },
        encodedContent: {
          type: String
        }
      },
      transform(node, config) {
        const attributes = node.transformAttributes(config);
        
        // Decode the content if it was encoded
        let content = '';
        if (attributes.encodedContent) {
          content = Buffer.from(attributes.encodedContent, 'base64').toString('utf-8');
          delete attributes.encodedContent; // Remove from attributes so it doesn't get passed to component
        }
        
        return {
          name: 'Mermaid',
          attributes: {
            ...attributes,
            content
          },
          children: []
        };
      }
    },
    component: {
      render: 'Component',
      attributes: {
        name: {
          type: String,
          required: true
        },
        props: {
          type: Object,
          default: {}
        }
      },
      selfClosing: true
    },
    dragon: {
      render: 'Dragon',
      attributes: {
        style: {
          type: String,
          default: 'animated'
        },
        speed: {
          type: Number,
          default: 1
        },
        color: {
          type: String,
          default: '#ffffff'
        }
      },
      selfClosing: true
    },
    rubik: {
      render: 'Rubik',
      attributes: {
        size: {
          type: String,
          default: 'medium',
          matches: ['small', 'medium', 'large']
        },
        cubes: {
          type: Number,
          default: 5
        },
        rotating: {
          type: Boolean,
          default: false
        },
        showControls: {
          type: Boolean,
          default: true
        },
        canvasId: {
          type: String,
          required: true
        }
      },
      selfClosing: true
    },
    taiji: {
      render: 'Taiji',
      attributes: {
        speed: {
          type: Number,
          default: 1
        }
      },
      selfClosing: true
    },
    lego: {
      render: 'Lego',
      attributes: {
        model: {
          type: String,
          default: 'default'
        }
      },
      selfClosing: true
    },
    callout: {
      render: 'Callout',
      children: ['paragraph', 'tag', 'list'],
      attributes: {
        type: {
          type: String,
          default: 'info',
          matches: ['info', 'warning', 'error', 'success', 'note']
        },
        title: {
          type: String
        }
      }
    },
    accordion: {
      render: 'Accordion',
      children: ['paragraph', 'tag', 'list'],
      attributes: {
        title: {
          type: String,
          required: true
        },
        defaultOpen: {
          type: Boolean,
          default: false
        }
      }
    },
    video: {
      render: 'Video',
      selfClosing: true,
      attributes: {
        src: {
          type: String,
          required: true
        },
        poster: {
          type: String
        },
        controls: {
          type: Boolean,
          default: true
        },
        autoplay: {
          type: Boolean,
          default: false
        },
        loop: {
          type: Boolean,
          default: false
        },
        muted: {
          type: Boolean,
          default: false
        },
        width: {
          type: String,
          default: '100%'
        },
        height: {
          type: String,
          default: 'auto'
        }
      }
    }
  }
};