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

  // Trim is used for matching, but we preserve the original input for display
  const trimmed = search.trim();

  // True if the typed text exactly matches an existing option (case-insensitive)
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

      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0"
        align="start"
        sideOffset={4}
      >
        <Command shouldFilter={false}>
          <CommandInput
            ref={inputRef}
            placeholder={searchPlaceholder}
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
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
              exactMatch === false &&
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
