import React, { useEffect, useMemo, useState } from 'react';
import { Button, Divider, Input, Select, Space, Typography, message } from 'antd';
import { PlusOutlined } from '@ant-design/icons';

const { Text } = Typography;

export const DEFAULT_BUSINESS_TYPES = {
  document_image: ['报关单', '检疫证书', '运单', '库存清单', '质检单'],
  conversation: ['咨询问答', '信息收集', '异常反馈', '投诉售后', '人工协作'],
  time_series: ['冷藏集装箱物流', 'GPS轨迹数据', '温湿度数据', '振动数据'],
};

const STORAGE_PREFIX = 'data-factory:business-types:v1:';
const CHANGE_EVENT = 'data-factory-business-types-change';

function storageKey(modality) {
  return `${STORAGE_PREFIX}${modality}`;
}

function readCustomTypes(modality) {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey(modality)) || '[]');
    return Array.isArray(parsed) ? parsed.filter(item => typeof item === 'string' && item.trim()) : [];
  } catch {
    return [];
  }
}

export function BusinessTypeSelect({ modality, value, onChange, disabled, placeholder = '请选择业务类型' }) {
  const presets = DEFAULT_BUSINESS_TYPES[modality] || [];
  const [customTypes, setCustomTypes] = useState(() => readCustomTypes(modality));
  const [draftName, setDraftName] = useState('');

  useEffect(() => {
    const refresh = event => {
      if (!event?.detail?.modality || event.detail.modality === modality) setCustomTypes(readCustomTypes(modality));
    };
    const refreshFromStorage = event => {
      if (event.key === storageKey(modality)) setCustomTypes(readCustomTypes(modality));
    };
    window.addEventListener(CHANGE_EVENT, refresh);
    window.addEventListener('storage', refreshFromStorage);
    return () => {
      window.removeEventListener(CHANGE_EVENT, refresh);
      window.removeEventListener('storage', refreshFromStorage);
    };
  }, [modality]);

  const normalizedCustomTypes = useMemo(() => {
    const values = [...customTypes];
    if (value && !presets.includes(value) && !values.includes(value)) values.unshift(value);
    return [...new Set(values)];
  }, [customTypes, presets, value]);

  const options = [
    { label: '预置业务类型', options: presets.map(item => ({ label: item, value: item })) },
    ...(normalizedCustomTypes.length ? [{ label: '自定义业务类型', options: normalizedCustomTypes.map(item => ({ label: item, value: item })) }] : []),
  ];

  const addCustomType = () => {
    const name = draftName.trim();
    if (!name) {
      message.warning('请输入业务类型名称');
      return;
    }
    if (name.length > 30) {
      message.warning('业务类型名称不能超过 30 个字符');
      return;
    }
    const allTypes = [...presets, ...customTypes];
    const existing = allTypes.find(item => item.toLocaleLowerCase() === name.toLocaleLowerCase());
    if (existing) {
      onChange?.(existing);
      setDraftName('');
      message.info('该业务类型已存在，已为你选中');
      return;
    }
    const next = [...customTypes, name];
    window.localStorage.setItem(storageKey(modality), JSON.stringify(next));
    setCustomTypes(next);
    setDraftName('');
    onChange?.(name);
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: { modality } }));
    message.success(`已添加并选中“${name}”`);
  };

  return <Select
    value={value}
    onChange={onChange}
    disabled={disabled}
    showSearch
    allowClear
    optionFilterProp="label"
    placeholder={placeholder}
    options={options}
    popupRender={menu => <div className="business-type-select-popup">
      {menu}
      <Divider style={{ margin: '8px 0' }}/>
      <div className="business-type-create" onMouseDown={event => event.stopPropagation()} onClick={event => event.stopPropagation()}>
        <Text strong>添加自定义业务类型</Text>
        <Text type="secondary" className="business-type-create-help">添加后会保存到业务类型列表，下次可直接选择。</Text>
        <Space.Compact block>
          <Input
            value={draftName}
            maxLength={30}
            placeholder="输入名称，如：保险理赔单"
            onChange={event => setDraftName(event.target.value)}
            onKeyDown={event => {
              event.stopPropagation();
              if (event.key === 'Enter') {
                event.preventDefault();
                addCustomType();
              }
            }}
          />
          <Button type="primary" icon={<PlusOutlined/>} disabled={!draftName.trim()} onClick={addCustomType}>添加并选中</Button>
        </Space.Compact>
      </div>
    </div>}
  />;
}
