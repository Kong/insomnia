import type { Project as AppProject } from "insomnia-data";

import type { ProjectType } from "../enums/project-types";

export class Project implements Pick<AppProject, "name"> {
  id?: string;

  constructor(
    readonly name: string,
    readonly type: ProjectType,
    /**
     * The absolute path of an existing local folder to adopt as this
     * project's git repo (running `git init` inside it if it isn't already
     * one), instead of cloning from a remote URL. Only meaningful for
     * `ProjectType.Git`; passing it to `WorkspaceFlow.create()` routes to
     * the create-project dialog's "Open local folder" mode.
     */
    readonly folderPath?: string,
  ) {}
}
