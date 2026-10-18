import { useId, useState } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';
import { Copy, Check } from 'lucide-react';
import { Button } from './ui/button';
export function Prose({ children }: { children: string }) {
  return (
    <div className="prose">
      <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
        {children}
      </Markdown>
    </div>
  );
}
export function Code({ code, label = 'Java' }: { code: string; label?: string }) {
  const [copied, setCopied] = useState(false),
    [error, setError] = useState('');
  return (
    <div className="code-block">
      <div className="code-toolbar">
        <span>{label}</span>
        <button
          aria-label="Copy code"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(code);
              setCopied(true);
            } catch {
              setError('Select the code to copy it manually.');
            }
          }}
        >
          {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre>
        <code>{code}</code>
      </pre>
      {error && <p role="status">{error}</p>}
    </div>
  );
}
export function Diagram({ source }: { source: string }) {
  const id = useId().replace(/:/g, ''),
    [svg, setSvg] = useState(''),
    [error, setError] = useState('');
  return (
    <section className="diagram">
      <Code code={source} label="Mermaid source" />
      <Button
        variant="outline"
        onClick={async () => {
          try {
            const mermaid = (await import('mermaid')).default;
            mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'neutral' });
            const { svg } = await mermaid.render(`diagram${id}`, source);
            setSvg(svg);
          } catch {
            setError('Diagram could not be rendered. The text source is available above.');
          }
        }}
      >
        Render architecture diagram
      </Button>
      {error && <p role="alert">{error}</p>}
      {svg && (
        <div
          className="diagram-output"
          role="img"
          aria-label="Architecture diagram"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      )}
    </section>
  );
}
