import type { BaseModel, PluginData } from 'insomnia-data';

import type { NunjucksParsedTag } from '~/common/templating/types';

export interface ArgConfigFormProps {
  configValue: string;
  activeTagDefinition: NunjucksParsedTag;
  activeTagData: NunjucksParsedTag;
  onChange: (newConfigValue: string) => void;
  vaultPluginData: PluginData[];
  docs: Record<string, BaseModel[]>;
  onConvertLegacyTag: (legacyCredentialId: string) => void;
}
