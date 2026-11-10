import type { RequestGroup } from "insomnia-data";

export class Folder implements Pick<RequestGroup, "name"> {
  id?: string;

  constructor(readonly name: string) {}
}
