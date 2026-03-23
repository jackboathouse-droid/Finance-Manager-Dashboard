import { useState, useCallback } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Plus, UserPlus, Loader2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

// ── Types ─────────────────────────────────────────────────────────────────────

interface Person {
  id: number;
  name: string;
  created_at: string;
}

// ── API helpers ───────────────────────────────────────────────────────────────

async function fetchPeople(): Promise<Person[]> {
  const res = await fetch(`${BASE}/api/people`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load people");
  return res.json();
}

async function createPerson(name: string): Promise<Person> {
  const res = await fetch(`${BASE}/api/people`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? "Failed to create person");
  }
  return res.json();
}

async function deletePerson(id: number): Promise<void> {
  const res = await fetch(`${BASE}/api/people/${id}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? "Failed to delete person");
  }
}

// ── Manage People Dialog ──────────────────────────────────────────────────────

function ManagePeopleDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [newName, setNewName] = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const { data: people = [], isLoading } = useQuery<Person[]>({
    queryKey: ["/api/people"],
    queryFn: fetchPeople,
    enabled: open,
  });

  const createMutation = useMutation({
    mutationFn: createPerson,
    onSuccess: (person) => {
      queryClient.setQueryData<Person[]>(["/api/people"], (prev = []) =>
        [...prev, person].sort((a, b) => a.name.localeCompare(b.name))
      );
      setNewName("");
      toast({ title: `"${person.name}" added` });
    },
    onError: (err: Error) => {
      toast({ title: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deletePerson,
    onSuccess: (_, id) => {
      queryClient.setQueryData<Person[]>(["/api/people"], (prev = []) =>
        prev.filter((p) => p.id !== id)
      );
      toast({ title: "Person removed" });
      setDeletingId(null);
    },
    onError: (err: Error) => {
      toast({ title: err.message, variant: "destructive" });
      setDeletingId(null);
    },
  });

  const handleAdd = () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    createMutation.mutate(trimmed);
  };

  const handleDelete = (id: number) => {
    setDeletingId(id);
    deleteMutation.mutate(id);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-primary" />
            Manage People
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Add new person */}
          <div className="flex gap-2">
            <Input
              placeholder="New person name…"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              className="h-9"
              autoFocus
            />
            <Button
              size="sm"
              onClick={handleAdd}
              disabled={!newName.trim() || createMutation.isPending}
              className="h-9 px-3 shrink-0"
            >
              {createMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
            </Button>
          </div>

          {/* People list */}
          <div className="border border-border/50 rounded-lg overflow-hidden">
            {isLoading ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Loading…
              </div>
            ) : people.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                No people yet. Add someone above.
              </div>
            ) : (
              <ul className="divide-y divide-border/40">
                {people.map((p) => (
                  <li key={p.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-muted/30">
                    <span className="text-sm font-medium">{p.name}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDelete(p.id)}
                      disabled={deletingId === p.id}
                    >
                      {deletingId === p.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            Removing a person from this list does not affect existing transactions.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── PeopleSelect ──────────────────────────────────────────────────────────────

export interface PeopleSelectProps {
  value: string;
  onChange: (name: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function PeopleSelect({
  value,
  onChange,
  placeholder = "Select person…",
  disabled,
}: PeopleSelectProps) {
  const [manageOpen, setManageOpen] = useState(false);

  const { data: people = [] } = useQuery<Person[]>({
    queryKey: ["/api/people"],
    queryFn: fetchPeople,
  });

  const handleValueChange = useCallback(
    (val: string) => {
      if (val === "__manage__") {
        setManageOpen(true);
        return;
      }
      onChange(val);
    },
    [onChange]
  );

  return (
    <>
      <Select value={value || ""} onValueChange={handleValueChange} disabled={disabled}>
        <SelectTrigger className="h-10">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {people.length === 0 && (
            <div className="px-3 py-2 text-xs text-muted-foreground italic">
              No people yet — click "Manage People" to add
            </div>
          )}
          {people.map((p) => (
            <SelectItem key={p.id} value={p.name}>
              {p.name}
            </SelectItem>
          ))}
          {/* Separator + manage action */}
          <div className="border-t border-border/50 mt-1 pt-1">
            <SelectItem value="__manage__" className="text-primary font-medium">
              <span className="flex items-center gap-1.5">
                <UserPlus className="h-3.5 w-3.5" />
                Manage People
              </span>
            </SelectItem>
          </div>
        </SelectContent>
      </Select>

      <ManagePeopleDialog
        open={manageOpen}
        onClose={() => setManageOpen(false)}
      />
    </>
  );
}
