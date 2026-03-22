import { useState, useRef, useCallback } from "react";
import { Check, ChevronsUpDown, Plus, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export interface ComboboxOption {
  value: string;
  label: string;
}

interface CreatableComboboxProps {
  value: string;
  options: ComboboxOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  className?: string;
  onSelect: (value: string) => void;
  onCreate: (inputValue: string) => Promise<ComboboxOption>;
}

export function CreatableCombobox({
  value,
  options,
  placeholder = "Select or create…",
  searchPlaceholder = "Search…",
  emptyText = "Nothing found.",
  disabled = false,
  className,
  onSelect,
  onCreate,
}: CreatableComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = options.find((o) => o.value === value);

  const trimmed = search.trim();

  const exactMatch = options.some(
    (o) => o.label.toLowerCase() === trimmed.toLowerCase()
  );

  const handleCreate = useCallback(async () => {
    if (!trimmed || creating) return;
    setCreating(true);
    try {
      const newOption = await onCreate(trimmed);
      onSelect(newOption.value);
      setSearch("");
      setOpen(false);
    } finally {
      setCreating(false);
    }
  }, [trimmed, creating, onCreate, onSelect]);

  const handleSelect = (val: string) => {
    onSelect(val);
    setSearch("");
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (!v) setSearch(""); }}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "h-10 w-full justify-between font-normal bg-background",
            !selected && "text-muted-foreground",
            className
          )}
        >
          <span className="truncate">{selected ? selected.label : placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>

      {/*
       * PopoverContent is constrained by --radix-popover-content-available-height,
       * a CSS variable that Radix sets to the remaining viewport space on the
       * side where the popover opens.  We subtract a small gutter (8px) so the
       * list never hugs the screen edge.  The Command inside is a flex-column
       * that fills the full available height; CommandList gets max-h-none so
       * it is no longer capped at the 300px default and instead scrolls within
       * the popover container.
       */}
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0 flex flex-col overflow-hidden"
        style={{
          maxHeight: "calc(var(--radix-popover-content-available-height, 320px) - 8px)",
        }}
        align="start"
        sideOffset={4}
      >
        <Command
          shouldFilter={false}
          className="flex flex-col flex-1 overflow-hidden min-h-0"
        >
          {/* Search input — always visible at top, never scrolls away */}
          <CommandInput
            ref={inputRef}
            placeholder={searchPlaceholder}
            value={search}
            onValueChange={setSearch}
          />

          {/*
           * CommandList: max-h-none overrides the 300px from command.tsx so
           * the list fills whatever height the popover has after the input.
           * flex-1 + min-h-0 ensure it shrinks properly in the flex chain.
           */}
          <CommandList className="flex-1 max-h-none min-h-0 overflow-y-auto overflow-x-hidden scroll-smooth">
            {/* Existing filtered options */}
            <CommandGroup>
              {options
                .filter((o) =>
                  o.label.toLowerCase().includes(trimmed.toLowerCase())
                )
                .map((option) => (
                  <CommandItem
                    key={option.value}
                    value={option.value}
                    onSelect={() => handleSelect(option.value)}
                    className="cursor-pointer"
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4 shrink-0",
                        value === option.value ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {option.label}
                  </CommandItem>
                ))}
            </CommandGroup>

            {/* Inline create option — only shown when there's input & no exact match */}
            {trimmed && !exactMatch && (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem
                    value={`__create__${trimmed}`}
                    onSelect={handleCreate}
                    disabled={creating}
                    className="cursor-pointer text-primary font-medium"
                  >
                    {creating ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="mr-2 h-4 w-4" />
                    )}
                    {creating ? "Creating…" : `Create "${trimmed}"`}
                  </CommandItem>
                </CommandGroup>
              </>
            )}

            {/* Empty state when nothing matches and no input */}
            {!trimmed && options.length === 0 && (
              <CommandEmpty>{emptyText}</CommandEmpty>
            )}

            {/* Empty state when filtered and nothing matches */}
            {trimmed &&
              !exactMatch &&
              options.filter((o) =>
                o.label.toLowerCase().includes(trimmed.toLowerCase())
              ).length === 0 && (
                <CommandEmpty className="py-2 text-xs text-muted-foreground">
                  No matches — create it above
                </CommandEmpty>
              )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
