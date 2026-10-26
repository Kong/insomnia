import { Banner, Button, Icon, LearnMoreLink, Tab, Tabs } from 'insomnia/src/basic-components';
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
  // Export Insomnia components used in the docs
  Input,
  Tab,
  Tabs,
  Banner,
  Button,
  Icon,
  LearnMoreLink,
  InputNumber,
  Select,
  Switch,
  Checkbox,
  CheckboxGroup,
};

export default ReactLiveScope;
