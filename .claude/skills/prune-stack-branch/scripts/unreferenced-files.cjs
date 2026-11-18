// Prints files inside PRUNE_DIRS that nothing live imports (whole-file candidates for removal)
const { liveFiles, tracked, inDirs, path, root } = require("./lib.cjs"); const live = liveFiles();
for (const f of tracked) if (inDirs(path.join(root, f)) && !live.has(f)) console.log(f);
