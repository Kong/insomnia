// packages/insomnia-component-docs/src/theme/ReactLiveScope/index.ts
import { Checkbox, CheckboxGroup } from 'insomnia/src/ui/components/base/checkbox';
import { Input } from 'insomnia/src/ui/components/base/input';
import { InputNumber } from 'insomnia/src/ui/components/base/input-number';
import { Select } from 'insomnia/src/ui/components/base/select';
import { Switch } from 'insomnia/src/ui/components/base/switch';
import React, { useState } from 'react';

const ReactLiveScope = {
  React,
  useState,
  // Spread all React exports if needed
  ...React,
  // Components
  Input,
  InputNumber,
  Select,
  Switch,
  Checkbox,
  CheckboxGroup,
};

export default ReactLiveScope;
