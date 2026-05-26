import { useMemo, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
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
      <DialogContent
        hideCloseButton
        className="max-h-[90vh] max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-[4px] border border-border bg-card p-0 text-foreground shadow-2xl sm:max-w-[448px]"
      >
        <div className="flex max-h-[82vh] flex-col overflow-hidden">
          <div className="border-b border-border bg-muted px-5 py-3">
            <div>
              <div className="text-base font-medium leading-none tracking-tight">Create poll</div>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">Ask a question and let people vote.</p>
            </div>
          </div>

          <div className="space-y-5 overflow-y-auto px-6 py-4">
            <div>
              <div className="flex items-center justify-between gap-3">
                <Label
                  htmlFor="poll-question"
                  className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                >
                  Question
                </Label>
                <span className="text-xs text-muted-foreground">{question.length}/300</span>
              </div>
              <Input
                id="poll-question"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Which coffee is better?"
                maxLength={300}
                className="mt-2 h-9 rounded-none border-0 border-b border-white/80 bg-transparent px-0 text-sm text-foreground shadow-none outline-none placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0"
              />
            </div>

            <div>
              <div className="flex items-center justify-between gap-3">
                <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Answers
                </Label>
                <span className="text-xs text-muted-foreground">{answers.length}/4</span>
              </div>
              <div className="mt-3 space-y-3">
                {answers.map((ans, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <Input
                      value={ans}
                      onChange={(e) => setAnswerAt(idx, e.target.value)}
                      placeholder={`Answer ${idx + 1}`}
                      maxLength={100}
                      className="h-9 rounded-none border-0 border-b border-white/80 bg-transparent px-0 text-sm text-foreground shadow-none outline-none placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0"
                    />
                    {answers.length > 2 && (
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => removeAnswer(idx)}
                        className="h-8 rounded-[3px] px-2 text-muted-foreground hover:bg-card hover:text-white"
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-3 flex items-center justify-between gap-3">
                <p className="text-xs leading-5 text-muted-foreground">Add between 2 and 4 answers.</p>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={addAnswer}
                  disabled={answers.length >= 4}
                  className="h-8 rounded-[3px] border border-border bg-card px-3 text-xs font-medium text-foreground hover:bg-card disabled:bg-card disabled:text-muted-foreground"
                >
                  Add answer
                </Button>
              </div>
            </div>

            <div className="border border-border bg-muted p-3">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="poll-multi"
                  checked={allowMultiple}
                  onCheckedChange={(v) => setAllowMultiple(v === true)}
                  className="mt-0.5 border-[#7d8591] data-[state=checked]:border-border data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
                />
                <div className="space-y-1">
                  <Label htmlFor="poll-multi" className="text-sm font-medium leading-none text-foreground">
                    Multiple votes allowed
                  </Label>
                  <p className="text-xs leading-5 text-muted-foreground">Let voters choose more than one answer.</p>
                </div>
              </div>
            </div>

            <div>
              <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Poll end time
              </Label>
              <Select value={String(durationSeconds)} onValueChange={(v) => setDurationSeconds(Number(v))}>
                <SelectTrigger className="mt-2 h-9 rounded-[3px] border-border bg-muted text-foreground focus:ring-0 focus:ring-offset-0">
                  <SelectValue placeholder="Select duration" />
                </SelectTrigger>
                <SelectContent className="border-border bg-card text-foreground">
                  {DURATION_PRESETS.map((p) => (
                    <SelectItem
                      key={p.seconds}
                      value={String(p.seconds)}
                      className="text-foreground data-[highlighted]:bg-card data-[highlighted]:text-white focus:bg-card focus:text-white"
                    >
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-border bg-card px-5 py-3">
            <Button
              type="button"
              variant="ghost"
              onClick={() => handleClose(false)}
              className="h-9 rounded-[3px] px-4 text-muted-foreground hover:bg-transparent hover:text-white"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={submit}
              disabled={!canSubmit}
              className="h-9 rounded-[3px] bg-primary px-5 font-medium text-primary-foreground hover:bg-white disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100"
            >
              Create poll
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

