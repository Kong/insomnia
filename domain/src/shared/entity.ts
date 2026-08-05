// Common fields every domain entity carries, mirroring what BaseModel already
// establishes in insomnia-data today. Kept minimal - only what's proven useful.
export interface Entity {
  _id: string;
  parentId: string;
  created: number;
  modified: number;
  isPrivate: boolean;
}
