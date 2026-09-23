import * as fs from "node:fs";
import * as os from "node:os";
import path from "node:path";

import { faker } from "@faker-js/faker";

import { ProjectType } from "../../enums/project-types";
import { expect, test } from "../../misc/git-fixtures";
import { Project } from "../../models/project";

test("Verify adopting an existing local folder as a Git project runs git init in it", async ({
  user,
}) => {
  const { workspaceFlow } = user.flowManager;

  const folderPath = fs.mkdtempSync(
    path.join(os.tmpdir(), "insomnia-open-local-folder-"),
  );
  await workspaceFlow.create(
    new Project(faker.string.alphanumeric(10), ProjectType.Git, folderPath),
  );

  await expect
    .poll(() => fs.existsSync(path.join(folderPath, ".git")))
    .toBe(true);
});
