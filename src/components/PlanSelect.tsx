import * as Select from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
import { useId } from "react";

type Props<T extends string> = {
  label: string;
  options: readonly T[];
  value: T;
  disabled: boolean;
  onChange: (value: T) => void;
};

export default function PlanSelect<T extends string>({
  label,
  options,
  value,
  disabled,
  onChange,
}: Props<T>) {
  const id = useId();
  return (
    <div className="plan-field">
      <label htmlFor={id}>{label}</label>
      <Select.Root
        value={value}
        disabled={disabled}
        onValueChange={(next) => {
          const choice = options.find((option) => option === next);
          if (choice !== undefined) onChange(choice);
        }}
      >
        <Select.Trigger id={id} className="plan-select-trigger">
          <Select.Value />
          <Select.Icon asChild>
            <ChevronDown aria-hidden="true" />
          </Select.Icon>
        </Select.Trigger>
        <Select.Portal>
          <Select.Content
            className="plan-select-menu"
            position="popper"
            align="start"
            sideOffset={5}
            collisionPadding={12}
          >
            <Select.Viewport>
              {options.map((option) => (
                <Select.Item key={option} value={option} className="plan-select-option">
                  <Select.ItemText>{option}</Select.ItemText>
                  <Select.ItemIndicator>
                    <Check aria-hidden="true" />
                  </Select.ItemIndicator>
                </Select.Item>
              ))}
            </Select.Viewport>
          </Select.Content>
        </Select.Portal>
      </Select.Root>
    </div>
  );
}
