import { gsap } from 'gsap';
import { MotionPathPlugin } from 'gsap/dist/MotionPathPlugin';
import type { RefObject } from 'react';

export const internals = {
  LINE_WIDTH: 1.5,
  DURATION: 2,
  TRIAL_SIZE_PERCENTAGE: '100%',
  GRADIENT_SUFFIXES: ['01', '02', '03', '04'],
  COMPACT_VERTICAL_SPACE: 20,
};

gsap.registerPlugin(MotionPathPlugin);

gsap.registerEffect({
  name: 'trail',
  /**
   * Left from @marckong here.
   * targets is TweenTarget.
   *
   * type TweenTarget = string | object | null;
   *
   * Therefore the below code is not typed correctly, but hey it works for free from the mentioned PR!
   * */
  effect(targets: any[], config: gsap.TimelineVars | undefined) {
    const group = targets[0];
    const dot = group?.querySelector('.dot');
    const rect = group?.querySelector('rect');

    return gsap
      .timeline({
        defaults: {
          ease: 'none',
          duration: internals.DURATION,
        },
        ...config,
      })
      .set(dot, { opacity: 1 })
      .to(
        dot,
        {
          motionPath: {
            path: group.dataset.motionPath,
          },
          onUpdate() {
            const x = +gsap.getProperty(this.targets()[0], 'x');
            rect.x.baseVal.value = x - rect?.width?.baseVal?.value;
          },
        },
        '<'
      )
      .to(rect, { attr: { x: '100%' } }, '>');
  },
});

export function animateTrailPaths(totalActiveLines: number, scope: RefObject<Element>[]) {
  const animations = new Set<GSAPAnimation>();

  const ctx = gsap.context(() => {
    const groups: Node[] = gsap.utils.toArray<Node>('.group-elements');
    const availableGroups = new Set<Node>([...groups]);

    function animate(delay = 0) {
      const group: Node = gsap.utils.random([...availableGroups]);
      availableGroups.delete(group);

      if (!group) {
        return;
      }

      return gsap.effects.trail(group, {
        delay,
        onComplete() {
          availableGroups.add(group);
          animations.delete(this);
          animations.add(animate());
        },
      });
    }

    for (let i = 0; i < totalActiveLines; i++) {
      animations.add(animate(gsap.utils.random(1, 3)));
    }
  }, scope);

  return () => {
    ctx.kill();
    Array.from(animations).forEach((a: GSAPAnimation) => {
      a?.kill();
    });
  };
}

export const random = gsap.utils.random;
