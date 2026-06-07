import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { DAY_OF_WEEK_LABELS } from "@shared/allowance-week";

type DayOfWeekSelectProps = {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  id?: string;
};

export function DayOfWeekSelect({ label, value, onValueChange, id }: DayOfWeekSelectProps) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger id={id} className="mint-input mt-1">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {DAY_OF_WEEK_LABELS.map((name, dow) => (
            <SelectItem key={dow} value={String(dow)}>
              {name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
