// tokens -> css variable -> tailwind config -> component usage
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const tailwindColors = require('tailwindcss/colors');

const background = {
  default: {
    _: { value: '#fff', type: 'color', comment: '' },
    hover: { value: tailwindColors.gray[100], type: 'color', comment: '' },
    active: { value: tailwindColors.gray[100], type: 'color', comment: '' },
    focus: { value: '#84cc16', type: 'color', comment: '' },
    disabled: '',
  },
  success: {
    base: '',
    hover: '',
    active: '',
    disabled: '',
  },
  notice: {
    base: '',
    hover: '',
    active: '',
    disabled: '',
  },
  warning: {
    base: '',
    hover: '',
    active: '',
    disabled: '',
  },
  danger: {
    base: '',
    hover: '',
    active: '',
    disabled: '',
  },
  surprise: {
    base: '',
    hover: '',
    active: '',
    disabled: '',
  },
  info: {
    base: '',
    hover: '',
    active: '',
    disabled: '',
  },
};
const text = {
  default: {
    _: { value: tailwindColors.gray[100], type: 'color', comment: '' },
    hover: { value: tailwindColors.gray[100], type: 'color', comment: '' },
    active: { value: tailwindColors.gray[100], type: 'color', comment: '' },
    disabled: { value: tailwindColors.gray[100], type: 'color', comment: '' },
  },
  success: {
    base: '',
    hover: '',
    active: '',
    disabled: '',
  },
  notice: {
    base: '',
    hover: '',
    active: '',
    disabled: '',
  },
  warning: {
    base: '',
    hover: '',
    active: '',
    disabled: '',
  },
  danger: {
    base: '',
    hover: '',
    active: '',
    disabled: '',
  },
  surprise: {
    base: '',
    hover: '',
    active: '',
    disabled: '',
  },
  info: {
    base: '',
    hover: '',
    active: '',
    disabled: '',
  },
};
const border = {
  default: {
    _: { value: tailwindColors.gray[100], type: 'color', comment: '' },
    hover: { value: tailwindColors.gray[100], type: 'color', comment: '' },
    active: { value: tailwindColors.gray[100], type: 'color', comment: '' },
    disabled: { value: tailwindColors.gray[100], type: 'color', comment: '' },
  },
  success: {
    base: '',
    hover: '',
    active: '',
    disabled: '',
  },
  notice: {
    base: '',
    hover: '',
    active: '',
    disabled: '',
  },
  warning: {
    base: '',
    hover: '',
    active: '',
    disabled: '',
  },
  danger: {
    base: '',
    hover: '',
    active: '',
    disabled: '',
  },
  surprise: {
    base: '',
    hover: '',
    active: '',
    disabled: '',
  },
  info: {
    base: '',
    hover: '',
    active: '',
    disabled: '',
  },
};

export default {
  background,
  text,
  border,
};
