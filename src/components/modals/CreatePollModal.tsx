import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuthStore } from "@/stores/authStore";
import { useMessageStore } from "@/stores/messageStore";
import { handleError, showWarning } from "@/lib/errorHandler";

type PollDurationPreset = { label: string; seconds: number };

const DURATION_PRESETS: PollDurationPreset[] = [
  { label: "1 min", seconds: 60 },
  { label: "30 mins", seconds: 30 * 60 },
  { label: "1 hour", seconds: 60 * 60 },
  { label: "12 hours", seconds: 12 * 60 * 60 },
  { label: "24 hours", seconds: 24 * 60 * 60 },
];

interface CreatePollModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  channelId: string;
}

export const CreatePollModal = ({ open, onOpenChange, channelId }: CreatePollModalProps) => {
  const { user } = useAuthStore();
  const { sendPoll, replyingTo, setReplyingTo } = useMessageStore();

  const [question, setQuestion] = useState("");
  const [answers, setAnswers] = useState<string[]>(["", ""]);
  const [allowMultiple, setAllowMultiple] = useState(false);
  const [durationSeconds, setDurationSeconds] = useState<number>(DURATION_PRESETS[1].seconds);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const trimmedQuestion = useMemo(() => question.trim(), [question]);
  const trimmedAnswers = useMemo(() => answers.map((a) => a.trim()).filter((a) => a.length > 0), [answers]);

  const canSubmit = useMemo(() => {
    return trimmedQuestion.length > 0 && trimmedQuestion.length <= 300 && trimmedAnswers.length >= 2 && trimmedAnswers.length <= 4 && trimmedAnswers.every((a) => a.length <= 100) && !!user && !isSubmitting;
  }, [trimmedQuestion, trimmedAnswers, user, isSubmitting]);

  const reset = () => {
    setQuestion("");
    setAnswers(["", ""]);
    setAllowMultiple(false);
    setDurationSeconds(DURATION_PRESETS[1].seconds);
    setIsSubmitting(false);
  };

  const handleClose = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    if (!nextOpen) reset();
  };

  const setAnswerAt = (idx: number, value: string) => {
    setAnswers((prev) => prev.map((a, i) => (i === idx ? value : a)));
  };

  const addAnswer = () => {
    setAnswers((prev) => (prev.length >= 4 ? prev : [...prev, ""]));
  };

  const removeAnswer = (idx: number) => {
    setAnswers((prev) => (prev.length <= 2 ? prev : prev.filter((_, i) => i !== idx)));
  };

  const submit = async () => {
    if (!user) return;
    const q = question.trim();
    const opts = trimmedAnswers.slice(0, 4);

    if (!q || opts.length < 2) {
      showWarning("Missing fields", "Please provide a question and at least 2 answers.");
      return;
    }

    setIsSubmitting(true);
    try {
      const replyId = replyingTo?.id;
      setReplyingTo(null);
      const sent = await sendPoll(channelId, user.id, q, opts, allowMultiple, durationSeconds, replyId);
      if (!sent) {
        showWarning("Failed to create poll", "Please try again.");
        return;
      }
      handleClose(false);
    } catch (e) {
      handleError(e, "Failed to create poll");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create poll</DialogTitle>
          <DialogDescription>Ask a question and let people vote.</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="poll-question">Question</Label>
              <span className="text-xs text-muted-foreground">{question.length}/300</span>
            </div>
            <Input
              id="poll-question"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Which coffee is better?"
              maxLength={300}
            />
          </div>

          <div className="space-y-2">
            <Label>Answers (up to 4)</Label>
            <div className="space-y-2">
              {answers.map((ans, idx) => (
                <div key={idx} className="flex gap-2">
                  <Input
                    value={ans}
                    onChange={(e) => setAnswerAt(idx, e.target.value)}
                    placeholder={`Answer ${idx + 1}`}
                    maxLength={100}
                  />
                  {answers.length > 2 && (
                    <Button type="button" variant="ghost" onClick={() => removeAnswer(idx)}>
                      Remove
                    </Button>
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-between items-center">
              <Button type="button" variant="secondary" onClick={addAnswer} disabled={answers.length >= 4}>
                Add answer
              </Button>
              <span className="text-xs text-muted-foreground">{answers.length}/4</span>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Checkbox
              id="poll-multi"
              checked={allowMultiple}
              onCheckedChange={(v) => setAllowMultiple(v === true)}
            />
            <div className="space-y-1">
              <Label htmlFor="poll-multi">Multiple votes allowed</Label>
              <p className="text-xs text-muted-foreground">Let voters choose more than one answer.</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Poll end time</Label>
            <Select value={String(durationSeconds)} onValueChange={(v) => setDurationSeconds(Number(v))}>
              <SelectTrigger>
                <SelectValue placeholder="Select duration" />
              </SelectTrigger>
              <SelectContent>
                {DURATION_PRESETS.map((p) => (
                  <SelectItem key={p.seconds} value={String(p.seconds)}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" rounded="xl" onClick={() => handleClose(false)}>
            Cancel
          </Button>
          <Button type="button" rounded="xl" onClick={submit} disabled={!canSubmit}>
            Create poll
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

