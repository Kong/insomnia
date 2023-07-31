
export const type = 'Organization';
export const prefix = 'org';

export interface Organization {
  _id: string;
  name: string;
  isPersonal: boolean;
}
