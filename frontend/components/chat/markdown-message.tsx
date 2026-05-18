"use client";

import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Lazy-loaded assistant message renderer.
 *
 * Split into its own module so `MessageList` can pull it via
 * `React.lazy() + <Suspense>` — pushing `react-markdown` + `remark-gfm`
 * (~35-45 KB gzipped combined) out of the initial bundle and into a
 * chunk that's only fetched when an assistant message actually needs
 * markdown rendering.
 *
 * Rendering map below applies multi-channel typographic hierarchy to
 * the assistant's markdown output:
 *   - Bold gets a subtle cyan-200 shift (breaks the all-white wall
 *     without screaming color).
 *   - List markers (numbers/bullets) take violet-300 — semantic
 *     emphasis on structure.
 *   - Inline code → cyan-200 mono on a tinted surface.
 *   - Links → cyan-300 underlined; consistent with the aurora palette.
 *
 * FAANG move: hierarchy applied to semantic patterns, not arbitrarily
 * to every emphasis.
 */
const markdownComponents: Components = {
  p: ({ children, ...props }) => (
    <p className="m-0 my-1.5 first:mt-0 last:mb-0" {...props}>
      {children}
    </p>
  ),
  strong: ({ children, ...props }) => (
    <strong
      className="font-semibold text-cyan-200 [text-shadow:0_0_8px_rgba(125,249,255,0.25)]"
      {...props}
    >
      {children}
    </strong>
  ),
  em: ({ children, ...props }) => (
    <em className="text-white/92 italic" {...props}>
      {children}
    </em>
  ),
  code: ({ children, className, ...props }) => {
    const isBlock = typeof className === "string" && className.startsWith("language-");
    if (isBlock) {
      return (
        <code className={className} {...props}>
          {children}
        </code>
      );
    }
    return (
      <code
        className="rounded-md bg-white/15 px-1.5 py-0.5 font-mono text-[0.88em] text-cyan-100"
        {...props}
      >
        {children}
      </code>
    );
  },
  pre: ({ children, ...props }) => (
    <pre
      className="my-2 overflow-x-auto rounded-lg border border-white/12 bg-white/10 p-3 text-[0.88em]"
      {...props}
    >
      {children}
    </pre>
  ),
  ul: ({ children, ...props }) => (
    <ul
      className="my-2 list-outside list-disc space-y-1 pl-5 marker:font-semibold marker:text-cyan-300/85"
      {...props}
    >
      {children}
    </ul>
  ),
  ol: ({ children, ...props }) => (
    <ol
      className="my-2 list-outside list-decimal space-y-1 pl-5 marker:font-semibold marker:text-cyan-300/85"
      {...props}
    >
      {children}
    </ol>
  ),
  li: ({ children, ...props }) => (
    <li className="text-white" {...props}>
      {children}
    </li>
  ),
  h1: ({ children, ...props }) => (
    <h1 className="mt-3 mb-1 font-bold text-white text-xl" {...props}>
      {children}
    </h1>
  ),
  h2: ({ children, ...props }) => (
    <h2 className="mt-3 mb-1 font-bold text-lg text-white" {...props}>
      {children}
    </h2>
  ),
  h3: ({ children, ...props }) => (
    <h3 className="mt-2 mb-1 font-bold text-base text-white" {...props}>
      {children}
    </h3>
  ),
  a: ({ children, href, ...props }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-cyan-300 underline underline-offset-2 transition hover:text-cyan-200"
      {...props}
    >
      {children}
    </a>
  ),
  blockquote: ({ children, ...props }) => (
    <blockquote
      className="my-2 border-violet-400/60 border-l-2 pl-3 text-white/85 italic"
      {...props}
    >
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-3 border-white/15 border-t" />,
};

interface MarkdownMessageProps {
  content: string;
}

/**
 * Default export so `React.lazy(() => import("./markdown-message"))` works
 * cleanly — `React.lazy` requires a default-export Promise per the React
 * docs.
 */
export default function MarkdownMessage({ content }: MarkdownMessageProps) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
      {content}
    </ReactMarkdown>
  );
}
