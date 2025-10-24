import { useState } from 'react';
import { type Key, Tab, TabList, TabPanel, Tabs } from 'react-aria-components';
import { useNavigate } from 'react-router';

import { Checkbox, CheckboxGroup } from '~/ui/components/base/checkbox';
import { Input } from '~/ui/components/base/input';
import { InputNumber } from '~/ui/components/base/input-number';
import { Select } from '~/ui/components/base/select';
import { Switch } from '~/ui/components/base/switch';
import { Icon } from '~/ui/components/icon';

const ComponentWrapper = ({ title, children }: { title: string; children: React.ReactNode }) => {
  return (
    <div className="my-4 text-[--color-font]">
      <h2 className="mb-2 text-lg font-bold">{title}</h2>
      <div className="preview-wrapper">{children}</div>
    </div>
  );
};

const ComponentsPreviewPage = () => {
  const [value, setValue] = useState('');
  const [component, setComponent] = useState<Key>('input');
  const navigate = useNavigate();

  const tabs = [{ id: 'input' }, { id: 'inputNumber' }, { id: 'checkbox' }, { id: 'select' }, { id: 'switch' }];
  return (
    <div className="text-[--color-font]">
      <div className="mb-2 ml-2 flex cursor-pointer items-center gap-2">
        <Icon onClick={() => navigate(-1)} className="text-xs" icon="chevron-left" />
        <h1 className="text-xl">Components Preview Page</h1>
      </div>
      <Tabs selectedKey={component} onSelectionChange={setComponent} orientation="vertical" className="flex">
        <TabList
          aria-label="Dynamic tabs"
          items={tabs}
          className="border-r border-solid border-[--hl] text-[--color-font]"
        >
          {item => (
            <Tab className="p-2" key={item.id} id={item.id}>
              {item.id}
            </Tab>
          )}
        </TabList>
        <TabPanel className="ml-4" id="input">
          <ComponentWrapper title="Default">
            <Input placeholder="placeholder" />
          </ComponentWrapper>
          <ComponentWrapper title="With label">
            <Input label="Label" placeholder="placeholder" />
          </ComponentWrapper>
          <ComponentWrapper title="Controlled value">
            Controlled value: {value}
            <Input label="Label" placeholder="placeholder" value={value} onChange={setValue} />
          </ComponentWrapper>
          <ComponentWrapper title="Default value">
            <Input label="Label" placeholder="placeholder" defaultValue="default value" />
          </ComponentWrapper>
          <ComponentWrapper title="Disable">
            <Input label="Label" isDisabled placeholder="placeholder" defaultValue="default value" />
          </ComponentWrapper>
          <ComponentWrapper title="ReadOnly">
            <Input label="Label" isReadOnly placeholder="placeholder" defaultValue="default value" />
          </ComponentWrapper>
        </TabPanel>
        <TabPanel className="ml-4" id="inputNumber">
          <ComponentWrapper title="Default">
            <InputNumber placeholder="placeholder" />
          </ComponentWrapper>

          <ComponentWrapper title="With label">
            <InputNumber label="Label" placeholder="placeholder" />
          </ComponentWrapper>

          <ComponentWrapper title="With stepper">
            <InputNumber step={5} placeholder="placeholder" />
          </ComponentWrapper>

          <ComponentWrapper title="With min=0 and max=20">
            <InputNumber min={0} max={20} placeholder="placeholder" />
          </ComponentWrapper>
        </TabPanel>
        <TabPanel className="ml-4" id="checkbox">
          <ComponentWrapper title="Default">
            <Checkbox>Default</Checkbox>
          </ComponentWrapper>

          <ComponentWrapper title="Disable">
            <Checkbox isDisabled>Disable</Checkbox>
          </ComponentWrapper>

          <ComponentWrapper title="ReadOnly">
            <Checkbox isReadOnly>ReadOnly</Checkbox>
          </ComponentWrapper>

          <ComponentWrapper title="Checkbox Group">
            <CheckboxGroup
              options={[
                { label: 'A', value: 'A' },
                { label: 'B', value: 'B' },
                { label: 'C', value: 'C' },
              ]}
            >
              ReadOnly
            </CheckboxGroup>
          </ComponentWrapper>
        </TabPanel>
        <TabPanel className="ml-4" id="select">
          <ComponentWrapper title="Default">
            <Select
              onChange={v => console.log(v)}
              value="A"
              options={[
                { label: 'A', value: 'A' },
                { label: 'BBBBBB', value: 'B' },
                { label: 'CCCCCC', value: 'C' },
              ]}
            />
          </ComponentWrapper>

          <ComponentWrapper title="Disabled">
            <Select
              onChange={v => console.log(v)}
              value="A"
              isDisabled
              options={[
                { label: 'A', value: 'A' },
                { label: 'BBBBBB', value: 'B' },
                { label: 'CCCCCC', value: 'C' },
              ]}
            />
          </ComponentWrapper>

          <ComponentWrapper title="Disabled options">
            <Select
              onChange={v => console.log(v)}
              value="A"
              disabledKeys={['B']}
              options={[
                { label: 'A', value: 'A' },
                { label: 'BBBBBB', value: 'B' },
                { label: 'CCCCCC', value: 'C' },
              ]}
            />
          </ComponentWrapper>
        </TabPanel>
        <TabPanel className="ml-4" id="switch">
          <ComponentWrapper title="Default">
            <Switch />
          </ComponentWrapper>

          <ComponentWrapper title="Disabled">
            <Switch isDisabled />
          </ComponentWrapper>

          <ComponentWrapper title="ReadOnly">
            <Switch isReadOnly />
          </ComponentWrapper>
        </TabPanel>
      </Tabs>
    </div>
  );
};

export default ComponentsPreviewPage;
