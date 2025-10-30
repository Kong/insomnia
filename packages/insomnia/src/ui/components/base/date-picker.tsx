import type { DatePickerProps, DateValue, ValidationResult } from 'react-aria-components';
import {
  Button,
  Calendar,
  CalendarCell,
  CalendarGrid,
  DateInput,
  DatePicker as RaDatePicker,
  DateSegment,
  Dialog,
  Group,
  Heading,
  Popover,
} from 'react-aria-components';

import { Icon } from '~/ui/components/icon';

interface CustomDatePickerProps<T extends DateValue> extends DatePickerProps<T> {
  label?: string;
  description?: string;
  errorMessage?: string | ((validation: ValidationResult) => string);
}

export const DatePicker = <T extends DateValue>({
  label,
  description,
  errorMessage,
  firstDayOfWeek,
  ...props
}: CustomDatePickerProps<T>) => {
  return (
    <RaDatePicker aria-label="Insomnia Date Picker" {...props}>
      <Group className="flex w-full items-center justify-between rounded border border-solid border-[--hl-sm] px-2 py-1 data-[invalid]:border-[--color-danger]">
        <DateInput>{segment => <DateSegment segment={segment} />}</DateInput>
        <Button>
          <Icon icon="chevron-down" />
        </Button>
      </Group>
      <Popover className="rounded border border-solid border-[--hl-sm] bg-[--color-bg] p-8 text-[--color-font]">
        <Dialog>
          <Calendar firstDayOfWeek={firstDayOfWeek}>
            <header className="mb-4 flex items-center justify-between">
              <Button slot="previous">
                <Icon icon="chevron-left" />
              </Button>
              <Heading />
              <Button slot="next">
                <Icon icon="chevron-right" />
              </Button>
            </header>
            <CalendarGrid>
              {date => (
                <CalendarCell className="w-8 text-center leading-8 data-[selected]:bg-[--color-surprise]" date={date} />
              )}
            </CalendarGrid>
          </Calendar>
        </Dialog>
      </Popover>
    </RaDatePicker>
  );
};
