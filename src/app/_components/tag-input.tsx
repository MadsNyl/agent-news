"use client";

import { useState, useRef } from "react";

interface TagOption {
  id: string;
  name: string;
  slug: string;
  count: number;
}

export function TagInput({
  tags,
  selectedTags,
  onAdd,
  onRemove,
}: {
  tags: TagOption[];
  selectedTags: string[];
  onAdd: (tag: string) => void;
  onRemove: (tag: string) => void;
}) {
  const [input, setInput] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = tags.filter(
    (t) =>
      t.name.toLowerCase().includes(input.toLowerCase()) &&
      !selectedTags.includes(t.name),
  );

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && input.trim()) {
      e.preventDefault();
      onAdd(input.trim());
      setInput("");
      setShowSuggestions(false);
    }
  }

  return (
    <div className="relative">
      <div className="flex flex-wrap gap-1.5 rounded-md border border-input bg-background px-3 py-2">
        {selectedTags.map((tag) => (
          <span
            key={tag}
            className="flex items-center gap-1 rounded bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground"
          >
            {tag}
            <button
              type="button"
              onClick={() => onRemove(tag)}
              className="text-muted-foreground hover:text-foreground"
            >
              &times;
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setShowSuggestions(true);
          }}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          onKeyDown={handleKeyDown}
          placeholder={selectedTags.length === 0 ? "Add tags..." : ""}
          className="min-w-[100px] flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
        />
      </div>

      {showSuggestions && input && filtered.length > 0 && (
        <ul className="absolute z-10 mt-1 max-h-40 w-full overflow-auto rounded-md border border-border bg-popover py-1 shadow-md">
          {filtered.slice(0, 8).map((tag) => (
            <li key={tag.slug}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onAdd(tag.name);
                  setInput("");
                  setShowSuggestions(false);
                  inputRef.current?.focus();
                }}
                className="w-full px-3 py-1.5 text-left text-sm text-foreground hover:bg-secondary"
              >
                {tag.name}
                <span className="ml-2 text-xs text-muted-foreground">
                  {tag.count}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
