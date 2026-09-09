'use client';

import { Select } from '@base-ui/react/select';
import { Check, ChevronDown } from 'lucide-react';

/** Fully styled dropdown so option lists match the HUD look on every
 *  platform (native popups ignore page colours on Windows). */
export default function HudSelect<T extends string>({
  id,
  value,
  onValueChange,
  options,
  label,
  placeholder = 'Choose…',
  disabled,
  className,
}: {
  id?: string;
  value: T;
  onValueChange: (value: T) => void;
  options: readonly (readonly [T, string])[];
  /** Accessible name when no visible <label htmlFor> points at the trigger. */
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}) {
  const current = options.find(([v]) => v === value);
  return (
    <Select.Root
      value={value}
      onValueChange={(next) => {
        if (next !== null) onValueChange(next as T);
      }}
      disabled={disabled}
    >
      <Select.Trigger
        id={id}
        aria-label={label}
        className={'hud-select-trigger' + (className ? ' ' + className : '')}
      >
        <span className="hud-select-value" data-placeholder={!current}>
          {current ? current[1] : placeholder}
        </span>
        <Select.Icon className="hud-select-icon">
          <ChevronDown size={14} aria-hidden="true" />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Positioner
          className="hud-select-positioner"
          sideOffset={6}
          alignItemWithTrigger={false}
        >
          <Select.Popup className="hud-select-popup">
            <Select.List className="hud-select-list">
              {options.map(([v, text]) => (
                <Select.Item key={v} value={v} className="hud-select-item">
                  <Select.ItemText>{text}</Select.ItemText>
                  <Select.ItemIndicator className="hud-select-check">
                    <Check size={13} aria-hidden="true" />
                  </Select.ItemIndicator>
                </Select.Item>
              ))}
            </Select.List>
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  );
}
