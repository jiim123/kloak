import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useAuthStore } from "@/stores/authStore";
import { usePollStore } from "@/stores/pollStore";
import { formatDistanceStrict } from "date-fns";

interface PollMessageProps {
  pollId: string;
}

export const PollMessage = ({ pollId }: PollMessageProps) => {
  const user = useAuthStore((s) => s.user);
  const poll = usePollStore((s) => s.pollsById[pollId]);
  const { fetchPoll, votePoll, closePoll } = usePollStore();

  const [selected, setSelected] = useState<number[]>([]);
  const [isVoting, setIsVoting] = useState(false);

  useEffect(() => {
    if (!poll) {
      fetchPoll(pollId).catch(() => undefined);
    }
  }, [pollId, poll, fetchPoll]);

  // Auto-close exactly at end time (best effort) so the UI updates to results via realtime.
  useEffect(() => {
    if (!poll || poll.is_closed) return;
    const endsAtMs = new Date(poll.ends_at).getTime();
    const msUntilEnd = endsAtMs - Date.now();
    if (msUntilEnd <= 0) {
      closePoll(pollId).catch(() => undefined);
      return;
    }
    const t = setTimeout(() => {
      closePoll(pollId).catch(() => undefined);
    }, msUntilEnd + 250);
    return () => clearTimeout(t);
  }, [pollId, poll?.ends_at, poll?.is_closed, closePoll, poll]);

  const isClosed = useMemo(() => {
    if (!poll) return false;
    if (poll.is_closed) return true;
    return new Date(poll.ends_at).getTime() <= Date.now();
  }, [poll]);

  const timeLabel = useMemo(() => {
    if (!poll) return null;
    const ends = new Date(poll.ends_at);
    if (isClosed) return "Poll closed";
    try {
      return `Ends in ${formatDistanceStrict(ends, new Date(), { addSuffix: false })}`;
    } catch {
      return null;
    }
  }, [poll, isClosed]);

  const canVote = useMemo(() => {
    return !!poll && !!user && !isClosed && poll.options.length > 0 && selected.length > 0 && !isVoting;
  }, [poll, user, isClosed, selected.length, isVoting]);

  const totalVotes = poll?.total_votes ?? 0;

  const toggle = (idx: number) => {
    if (!poll || isClosed) return;
    if (poll.allow_multiple) {
      setSelected((prev) => (prev.includes(idx) ? prev.filter((x) => x !== idx) : [...prev, idx].sort((a, b) => a - b)));
    } else {
      setSelected([idx]);
    }
  };

  const submitVote = async () => {
    if (!poll || !user) return;
    setIsVoting(true);
    try {
      await votePoll(pollId, user.id, selected);
    } finally {
      setIsVoting(false);
    }
  };

  if (!poll) {
    return (
      <div className="rounded-xl border border-border bg-secondary/40 p-4">
        <div className="text-sm text-muted-foreground">Loading poll…</div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-secondary/40 p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="text-[11px] font-semibold tracking-wider text-muted-foreground">POLL</div>
        {timeLabel && <div className="text-[11px] text-muted-foreground">{timeLabel}</div>}
      </div>

      <div className="text-sm font-semibold mb-3">{poll.question}</div>

      <div className="space-y-2">
        {isClosed ? (
          poll.options.map((opt, idx) => {
            const count = poll.results?.[idx] ?? 0;
            const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
            return (
              <div key={idx} className="rounded-lg border border-border bg-background/40 p-3">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="text-sm">{opt}</div>
                  <div className="text-xs text-muted-foreground">
                    {count} ({pct}%)
                  </div>
                </div>
                <Progress value={pct} className="h-2" />
              </div>
            );
          })
        ) : poll.allow_multiple ? (
          poll.options.map((opt, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => toggle(idx)}
              className={`w-full text-left rounded-lg border px-3 py-2 flex items-center gap-3 transition-colors ${
                selected.includes(idx) ? "border-primary bg-primary/10" : "border-border bg-background/40 hover:bg-muted/40"
              }`}
            >
              <Checkbox
                checked={selected.includes(idx)}
                onCheckedChange={() => undefined}
                onClick={(e) => e.stopPropagation()}
              />
              <span className="text-sm">{opt}</span>
            </button>
          ))
        ) : (
          <RadioGroup value={selected[0] != null ? String(selected[0]) : ""} onValueChange={(v) => toggle(Number(v))}>
            {poll.options.map((opt, idx) => (
              <label
                key={idx}
                className={`w-full text-left rounded-lg border px-3 py-2 flex items-center gap-3 cursor-pointer transition-colors ${
                  selected[0] === idx ? "border-primary bg-primary/10" : "border-border bg-background/40 hover:bg-muted/40"
                }`}
              >
                <RadioGroupItem value={String(idx)} />
                <span className="text-sm">{opt}</span>
              </label>
            ))}
          </RadioGroup>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="text-xs text-muted-foreground">{totalVotes} vote{totalVotes === 1 ? "" : "s"}</div>
        {!isClosed && (
          <Button size="sm" onClick={submitVote} disabled={!canVote}>
            Vote
          </Button>
        )}
      </div>
    </div>
  );
};

