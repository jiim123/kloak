import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
  const [fetchError, setFetchError] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);

  // Fetch poll with user votes on mount
  useEffect(() => {
    if (!hasFetched && !fetchError) {
      setHasFetched(true);
      fetchPoll(pollId, user?.id).catch(() => setFetchError(true));
    }
  }, [pollId, user?.id, fetchPoll, fetchError, hasFetched]);

  // Initialize selected state from user's previous votes
  useEffect(() => {
    if (poll?.userVotes && poll.userVotes.length > 0 && selected.length === 0) {
      setSelected(poll.userVotes);
    }
  }, [poll?.userVotes, selected.length]);

  // Check if user has already voted (from stored userVotes)
  const hasVoted = useMemo(() => {
    return poll?.userVotes && poll.userVotes.length > 0;
  }, [poll?.userVotes]);

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

  // Show results if poll is closed OR if user has already voted
  const showResults = isClosed || hasVoted;

  const canVote = useMemo(() => {
    return !!poll && !!user && !isClosed && !hasVoted && poll.options.length > 0 && selected.length > 0 && !isVoting;
  }, [poll, user, isClosed, hasVoted, selected.length, isVoting]);

  const totalVotes = poll?.total_votes ?? 0;

  const toggle = (idx: number) => {
    if (!poll || isClosed || hasVoted) return;
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

  if (fetchError) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 max-w-[520px]">
        <div className="text-sm text-destructive">Failed to load poll</div>
      </div>
    );
  }

  if (!poll) {
    return (
      <div className="rounded-xl border border-border p-4 max-w-[520px]" style={{ backgroundColor: '#131416' }}>
        <div className="text-sm text-muted-foreground">Loading poll…</div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border p-5 max-w-[520px] w-full" style={{ backgroundColor: '#131416' }}>
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
          <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" xmlns="http://www.w3.org/2000/svg">
            <path d="M11.7518706,1.99956021 C13.2716867,1.99956021 14.5037411,3.23161462 14.5037411,4.75143076 L14.5037411,19.2499651 C14.5037411,20.7697812 13.2716867,22.0018356 11.7518706,22.0018356 C10.2320544,22.0018356 9,20.7697812 9,19.2499651 L9,4.75143076 C9,3.23161462 10.2320544,1.99956021 11.7518706,1.99956021 Z M18.7518706,6.99956021 C20.2716867,6.99956021 21.5037411,8.23161462 21.5037411,9.75143076 L21.5037411,19.2499651 C21.5037411,20.7697812 20.2716867,22.0018356 18.7518706,22.0018356 C17.2320544,22.0018356 16,20.7697812 16,19.2499651 L16,9.75143076 C16,8.23161462 17.2320544,6.99956021 18.7518706,6.99956021 Z M4.75187055,11.9995602 C6.27168669,11.9995602 7.5037411,13.2316146 7.5037411,14.7514308 L7.5037411,19.2499651 C7.5037411,20.7697812 6.27168669,22.0018356 4.75187055,22.0018356 C3.23205441,22.0018356 2,20.7697812 2,19.2499651 L2,14.7514308 C2,13.2316146 3.23205441,11.9995602 4.75187055,11.9995602 Z" />
          </svg>
          Poll
        </div>
        {timeLabel && <div className="text-[11px] text-muted-foreground">{timeLabel}</div>}
      </div>

      <div className="text-sm font-semibold mb-3">{poll.question}</div>

      <div className="space-y-2">
        {showResults ? (
          poll.options.map((opt, idx) => {
            const count = poll.results?.[idx] ?? 0;
            const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
            const isUserVote = poll.userVotes?.includes(idx);
            return (
              <div 
                key={idx} 
                className={`relative rounded-lg border overflow-hidden p-3 ${
                  isUserVote ? "border-primary" : "border-border"
                }`}
                style={{
                  background: pct > 0 
                    ? `linear-gradient(90deg, hsl(var(--primary) / 0.25) ${pct}%, hsl(var(--background) / 0.4) ${pct}%)`
                    : 'hsl(var(--background) / 0.4)'
                }}
              >
                <div className="flex items-center justify-between gap-2 relative z-10">
                  <div className="flex items-center gap-2">
                    {isUserVote && (
                      <span className="text-primary text-xs font-medium">✓</span>
                    )}
                    <div className="text-sm font-medium">{opt}</div>
                  </div>
                  <div className="text-xs text-muted-foreground font-semibold">
                    {count} ({pct}%)
                  </div>
                </div>
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
                selected.includes(idx) 
                  ? "border-primary bg-primary/10" 
                  : "border-border bg-muted/30 hover:bg-muted/60 hover:border-muted-foreground/30"
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
                  selected[0] === idx 
                    ? "border-primary bg-primary/10" 
                    : "border-border bg-muted/30 hover:bg-muted/60 hover:border-muted-foreground/30"
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
        {!showResults && (
          <Button size="sm" onClick={submitVote} disabled={!canVote}>
            Vote
          </Button>
        )}
      </div>
    </div>
  );
};

