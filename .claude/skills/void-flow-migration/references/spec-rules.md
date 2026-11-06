# Phase 2: adapt specs (tests/**) to void flows

Repo: /Users/bob.qiu/Desktop/works/insomnia/packages/insomnia-test (ONLY this package; never works/insomnia-test).
Phase 1 is DONE: every public flow method (flows/*.flow.ts) now returns Promise<void>; pure reads were deleted from flows and live on pages /
components / FlowContext. Your job: fix the spec files in YOUR test directories so they compile and keep EXACTLY the same test intent.

Migration guides (old flow method -> new spec-side call sequence), in this directory: mapping-workspace.md, mapping-requests.md,
mapping-mcp-mock-git.md, mapping-misc.md. Read the ones relevant to the flows your specs use.
