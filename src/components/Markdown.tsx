import python from 'highlight.js/lib/languages/python';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import remarkGfm from 'remark-gfm';

import { cn } from '@/lib/utils';

export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={cn('markdown', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeHighlight, { detect: false, languages: { python } }]]}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
