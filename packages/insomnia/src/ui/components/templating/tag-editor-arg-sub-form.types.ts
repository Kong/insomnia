import type { BaseModel } from 'insomnia-data';

import type { NunjucksParsedTag } from '~/common/templating/types';

export interface ArgConfigFormProps {
  configValue: string;
  activeTagDefinition: NunjucksParsedTag;
  activeTagData: NunjucksParsedTag;
  onChange: (newConfigValue: string) => void;
  docs: Record<string, BaseModel[]>;
}
