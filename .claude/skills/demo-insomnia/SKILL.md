---
name: demo-insomnia
description: 'Walk the user through something in the running Insomnia app one step at a time, narrating each step in chat and pausing until they say continue. Use it after reproducing a bug, after fixing one, and after finishing a feature — driving the UI at machine speed shows the user nothing, so stop and replay it for them. Also when they ask to be shown, walked through, or given a demo of anything in the app.'
---

You just drove the Insomnia UI at machine speed. The user watched windows flash
and learned nothing. Replay it for them, one step at a time.

Builds on the `run-insomnia` skill — its driver must be running. `D=$S/drive.mjs`
below, as in that skill.

**Narrate in chat. The app window is where they watch, chat is where you
explain.** Do not paint captions or highlights into the app unless the user
asks for them (see "In-app overlay" at the end).

## The contract

Break any of these and the demo is worthless:

1. **Rehearse first, demo second.** Get the whole thing working at full speed
   before you show anyone. A demo is a performance of a known-good script, not
   an investigation. The user must never watch you guess or recover.
2. **Reset to a clean starting point, and make describing it step 1.** The
   demo has to be reproducible and has to begin somewhere the user recognises.
   Give the starting state its own pause, before anything moves — which
   profile, what was set up for them, what is on screen now. It is the one step
   that performs no action, and it earns its stop: the user cannot follow a
   change they never saw the "before" of.
3. **One step per conversation turn.** Act, narrate, stop. Never run two steps
   in one turn, however trivial the second looks.
4. **Stop by asking, not by waiting.** Never block the driver waiting for the
   user: a blocked driver cannot answer a question, and they are entitled to
   interrupt at any point. The pause is a turn boundary.
5. **Act first, then narrate.** Perform the step, then describe what happened.
   Announcing an action you have not taken yet wastes a pause on information
   the user cannot verify.

## Each step

Write the demo in English, headings included.

Perform the action, then write exactly these three things:

> **What I did** — the action, in terms of what a user would do, not which op
> you called. "Clicked Send, top right" not "click on request-pane Send".
>
> **What to look at** — where to look and what it means. Name the location in
> words, since there is no highlight: "the status tag at the top of the right
> pane, now reading 200 OK". If the interesting thing is an *absence*, say so —
> the user cannot see a thing that failed to happen unless you point at the gap.
>
> **Next** — one sentence. This is what removes the need for a separate
> "about to do X" step.

Then ask the user to continue, offering **Continue / Replay this step / I have
a question**. They can also just type; answer, then re-offer.

Keep each of the three to a sentence or two. Depth belongs in the answer to a
question they actually asked.

**Screenshots:** the user is watching the live window, so don't attach one by
default. Attach one when the change is easy to miss, when it is the payoff
frame of a bug repro, or when they have been reading chat and probably looked
away.

**Cross-check the important claims.** When you say the status is 200 OK, read it back
with `text` or `db` and say you did. On a bug demo this is the difference
between showing a symptom and proving it.

## The three scripts

**Reproducing a bug.** End on the broken state and stop there — that is the
whole point. Screenshot it. Say what *should* have happened next to what did.
Only then offer to start fixing.

**Proving a fix.** Same steps, same order, same words as the repro. The user
already knows the script, so the only new information is the different ending;
don't make them re-learn the setup. If the repro was 5 steps, this is 5 steps.

**Touring a feature.** The happy path first, in the order a real user meets it.
Then one thing that used to be hard and now isn't. Skip configuration nobody
will touch.

## Writing good steps

- Fold the setup clicking into step 1's description. "Starting point: the
  smoke-test collection is imported" beats four steps of watching an import.
- Aim for 4–6 steps including the opening. Beyond that you are narrating, not
  demonstrating.
- **Every later pause must correspond to a visible change of state.** Step 1 is
  the only one that stops without having done anything. A step whose whole
  content is "next I will click X" does not earn a stop — that sentence belongs
  at the end of the previous step, which is what the **Next** line is for.
- Say why a step exists when it isn't obvious: "a request has to be sent
  first, or the response pane is empty and the bug cannot trigger".
- Mention the profile when it matters. On `mock` nothing leaves the machine; on
  `prod` the demo is writing to a real account.

## In-app overlay (opt-in)

Only when the user asks to see captions in the window — screen recording, or
showing it to someone else:

```bash
node $D demo '{"step":2,"of":5,"text":"...","target":{"role":"button","name":"Send"}}'
node $D demo '{"clear":true}'
```

It paints a caption bar and rings the target element. `position: "top"` moves
the bar off Insomnia's own status bar. It does not wait for anyone — the pause
is still a turn boundary.

Even then, keep narrating in chat: the caption holds one sentence, the
reasoning does not fit.

## Gotchas

- **`reload` and `relaunch` wipe the overlay**, and `quit` ends it entirely.
- **The highlight is measured once.** If the app re-renders or scrolls, re-issue
  the same step rather than leaving a stale ring.
- **Don't demo on `prod` if the script writes anything you wouldn't want kept.**
  Use `mock`, or a scratch project created for the purpose.
- If a rehearsed step fails mid-demo, say so plainly and stop. Do not improvise
  a different route in front of the user — rehearse again first.
