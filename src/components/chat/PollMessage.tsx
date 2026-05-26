import { useEffect, useMemo, useRef, useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  const [showResultsOverride, setShowResultsOverride] = useState(false);
  const [isEditingResponse, setIsEditingResponse] = useState(false);
  const isClosingRef = useRef(false);

  useEffect(() => {
    if (!hasFetched && !fetchError) {
      setHasFetched(true);
      fetchPoll(pollId, user?.id).catch(() => setFetchError(true));
    }
  }, [pollId, user?.id, fetchPoll, fetchError, hasFetched]);

  useEffect(() => {
    if (poll?.userVotes && poll.userVotes.length > 0 && selected.length === 0) {
      setSelected(poll.userVotes);
    }
  }, [poll?.userVotes, selected.length]);

  const hasVoted = useMemo(() => {
    return !!poll?.userVotes && poll.userVotes.length > 0;
  }, [poll?.userVotes]);

  useEffect(() => {
    if (!poll || poll.is_closed) return;
    const endsAtMs = new Date(poll.ends_at).getTime();
    const msUntilEnd = endsAtMs - Date.now();

    const doClose = () => {
      if (isClosingRef.current) return;
      isClosingRef.current = true;
      closePoll(pollId)
        .catch(() => undefined)
        .finally(() => {
          isClosingRef.current = false;
        });
    };

    if (msUntilEnd <= 0) {
      doClose();
      return;
    }

    const t = setTimeout(doClose, msUntilEnd + 250);
    return () => clearTimeout(t);
  }, [pollId, poll?.ends_at, poll?.is_closed, closePoll]);

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

  const showResults = isClosed || (!isEditingResponse && (hasVoted || showResultsOverride));
  const totalVotes = poll?.total_votes ?? 0;
  const userResponseCount = poll?.userVotes?.length ?? 0;

  const canVote = useMemo(() => {
    return !!poll && !!user && !isClosed && poll.options.length > 0 && selected.length > 0 && !isVoting;
  }, [poll, user, isClosed, selected.length, isVoting]);

  const toggle = (idx: number) => {
    if (!poll || isClosed || (hasVoted && !isEditingResponse) || (showResults && !isEditingResponse)) return;
    if (poll.allow_multiple) {
      setSelected((prev) =>
        prev.includes(idx) ? prev.filter((x) => x !== idx) : [...prev, idx].sort((a, b) => a - b),
      );
      return;
    }
    setSelected([idx]);
  };

  const submitVote = async () => {
    if (!poll || !user) return;
    setIsVoting(true);
    try {
      await votePoll(pollId, user.id, selected);
      setIsEditingResponse(false);
      setShowResultsOverride(false);
    } finally {
      setIsVoting(false);
    }
  };

  const handleEditResponse = () => {
    if (isClosed || !poll?.userVotes?.length) return;
    setSelected(poll.userVotes);
    setIsEditingResponse(true);
    setShowResultsOverride(false);
  };

  const handleViewResultsToggle = () => {
    setIsEditingResponse(false);
    setShowResultsOverride((prev) => !prev);
  };

  if (fetchError) {
    return (
      <div className="max-w-[520px] rounded-[2px] border border-destructive/30 bg-destructive/10 p-4">
        <div className="text-sm text-destructive">Failed to load poll</div>
      </div>
    );
  }

  if (!poll) {
    return (
      <div className="max-w-[520px] rounded-[2px] border border-border bg-background p-4">
        <div className="text-sm text-muted-foreground">Loading poll...</div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[520px] rounded-[2px] border border-border bg-muted px-4 py-3 text-foreground">
      <div className="text-[15px] font-semibold leading-5 text-foreground">{poll.question}</div>
      {showResults && (
        <div className="mt-1 text-[12px] text-muted-foreground">
          {totalVotes} response{totalVotes === 1 ? "" : "s"}
        </div>
      )}

      <div className="mt-3 space-y-2.5">
        {poll.options.map((opt, idx) => {
          const count = poll.results?.[idx] ?? 0;
          const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
          const isSelected = selected.includes(idx);
          const isUserVote = poll.userVotes?.includes(idx);

          if (showResults) {
            return (
              <div
                key={idx}
                className={`flex items-center justify-between gap-3 rounded-[2px] px-3 py-1.5 text-[12px] font-semibold leading-5 ${
                  isUserVote ? "bg-[#5865f2] text-foreground" : "bg-background text-foreground"
                }`}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span className="truncate">{opt}</span>
                  {isUserVote && <Check className="h-3.5 w-3.5 shrink-0 text-foreground" strokeWidth={3} />}
                </div>
                <span className={isUserVote ? "text-foreground" : "text-foreground"}>{pct}%</span>
              </div>
            );
          }

          return (
            <button
              key={idx}
              type="button"
              onClick={() => toggle(idx)}
              className="flex w-full items-center gap-2.5 text-left text-sm text-foreground"
            >
              <span
                className={`h-3.5 w-3.5 shrink-0 rounded-full border transition-colors ${
                  isSelected ? "border-border bg-primary" : "border-border bg-transparent"
                }`}
              />
              <span>{opt}</span>
            </button>
          );
        })}
      </div>

      {showResults ? (
        <div className="mt-5">
          <div className="flex flex-wrap items-center gap-3">
            {!isClosed && userResponseCount > 0 && (
              <button
                type="button"
                onClick={handleEditResponse}
                className="text-[13px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
              >
                Edit response
              </button>
            )}
            {!isClosed && !hasVoted && showResultsOverride && (
              <button
                type="button"
                onClick={handleViewResultsToggle}
                className="text-[13px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
              >
                Back to poll
              </button>
            )}
          </div>
          {timeLabel && <div className="mt-3 text-[11px] text-muted-foreground">{timeLabel}</div>}
        </div>
      ) : (
        <>
          <div className="mt-5 flex items-center justify-between gap-3">
            <Button
              size="sm"
              onClick={submitVote}
              disabled={!canVote}
              className="h-8 rounded-[3px] bg-primary px-4 text-xs font-medium text-primary-foreground hover:bg-foreground/90 disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100"
            >
              {isVoting ? "Submitting..." : hasVoted || isEditingResponse ? "Update" : "Submit"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleViewResultsToggle}
              disabled={isClosed}
              className="h-8 rounded-[3px] border-border bg-transparent px-4 text-xs font-medium text-foreground hover:bg-muted hover:text-foreground disabled:border-border disabled:bg-transparent disabled:text-muted-foreground disabled:opacity-100"
            >
              {showResultsOverride ? "Back to poll" : "View results"}
            </Button>
          </div>
          {timeLabel && <div className="mt-3 text-[11px] text-muted-foreground">{timeLabel}</div>}
        </>
      )}
    </div>
  );
};
