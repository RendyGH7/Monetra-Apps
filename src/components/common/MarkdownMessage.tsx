import React from 'react';

interface MarkdownMessageProps {
  content: string;
}

export const MarkdownMessage: React.FC<MarkdownMessageProps> = ({ content }) => {
  const lines = content.split('\n');

  const renderFormattedInline = (text: string) => {
    // Regex for bold **text**, inline code `code`
    const parts = text.split(/(\*\*.*?\*\*|`.*?`)/g);

    return parts.map((part, idx) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        const inner = part.slice(2, -2);
        return (
          <strong key={idx} className="font-semibold text-[var(--text-primary)]">
            {inner}
          </strong>
        );
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        const inner = part.slice(1, -1);
        return (
          <code
            key={idx}
            className="px-1.5 py-0.5 rounded-md bg-white/[0.08] text-[var(--accent)] font-mono text-[11px]"
          >
            {inner}
          </code>
        );
      }
      return <span key={idx}>{part}</span>;
    });
  };

  const renderedElements: React.ReactNode[] = [];
  let currentList: { key: number; items: string[] } | null = null;

  const flushList = () => {
    if (currentList && currentList.items.length > 0) {
      const listToRender = currentList;
      renderedElements.push(
        <ul key={`list-${listToRender.key}`} className="space-y-1.5 my-2 pl-1">
          {listToRender.items.map((item, itemIdx) => (
            <li key={itemIdx} className="flex items-start gap-2.5 leading-relaxed">
              <span className="w-1.5 h-1.5 rounded-full bg-[#E39A5E] mt-2 shrink-0 shadow-xs" />
              <span className="flex-1">{renderFormattedInline(item)}</span>
            </li>
          ))}
        </ul>
      );
      currentList = null;
    }
  };

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx];
    const trimmed = line.trim();

    // Empty line
    if (!trimmed) {
      flushList();
      continue;
    }

    // Heading: ### or ## or #
    if (trimmed.startsWith('#')) {
      flushList();
      const headingText = trimmed.replace(/^#+\s*/, '');
      renderedElements.push(
        <h4
          key={`h-${idx}`}
          className="font-bold text-xs sm:text-sm text-[var(--accent)] mt-3 mb-1.5 tracking-tight flex items-center gap-1.5"
        >
          <span>{renderFormattedInline(headingText)}</span>
        </h4>
      );
      continue;
    }

    // Bullet point: * or - or •
    if (trimmed === '*' || trimmed === '-' || trimmed === '•') {
      continue;
    }

    if (trimmed.startsWith('* ') || trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
      const itemText = trimmed.replace(/^[*\-•]\s+/, '').trim();
      if (!itemText) continue;
      if (!currentList) {
        currentList = { key: idx, items: [itemText] };
      } else {
        currentList.items.push(itemText);
      }
      continue;
    }

    // Numbered list: 1. 2. etc
    const numMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
    if (numMatch) {
      flushList();
      renderedElements.push(
        <div key={`num-${idx}`} className="flex items-start gap-2 my-1 leading-relaxed">
          <span className="font-bold text-xs text-[#E39A5E] shrink-0 mt-0.5">
            {numMatch[1]}.
          </span>
          <span className="flex-1">{renderFormattedInline(numMatch[2])}</span>
        </div>
      );
      continue;
    }

    // Regular paragraph
    flushList();
    renderedElements.push(
      <p key={`p-${idx}`} className="my-1.5 leading-relaxed">
        {renderFormattedInline(trimmed)}
      </p>
    );
  }

  // Flush any trailing list
  flushList();

  return <div className="space-y-1 text-xs sm:text-sm text-[var(--text-primary)]">{renderedElements}</div>;
};
