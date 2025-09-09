import type { ThemeProps } from '@rjsf/core';
import type { RegistryWidgetsType, WidgetProps } from '@rjsf/utils';

const CustomTextWidget = (props: WidgetProps) => {
  return (
    <input
      className="w-full rounded-sm border border-solid border-[--hl-sm] bg-[--color-bg] py-1 pl-2 pr-7 text-[--color-font] transition-colors placeholder:italic focus:outline-none focus:ring-1 focus:ring-[--hl-md]"
      onChange={e => props.onChange(e.target.value)}
    />
  );
};

const themeWidgets: RegistryWidgetsType = {
  TextWidget: CustomTextWidget,
};
const themeTemplates = {};

const ThemeObject: ThemeProps = {
  widgets: themeWidgets,
  templates: themeTemplates,
};
export default ThemeObject;
