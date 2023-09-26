import { promises } from 'fs';
import { join as pathJoin, resolve as pathResolve } from 'path';
import { optimize, OptimizedSvg } from 'svgo';
const { readFile, writeFile } = promises;
import { version as appConfigVersion } from '../../packages/insomnia/package.json';

async function main() {
  await renderImage();
}

async function renderImage() {
  let type = 'major';
  let revision = '0';

  if (appConfigVersion.includes('beta')) {
    type = 'beta';
    const appConfigRevision = appConfigVersion.match(/^\d+\.\d+\.\d+-beta\.(\d+)/);
    if (!appConfigRevision) {
      throw new Error('Invalid app version beta revision');
    }
    revision = appConfigRevision[1];
  } else if (!appConfigVersion.endsWith('.0')) {
    type = 'patch';
  }

  // Ignore any semver prerelease/build tags
  const cleanedAppConfigVersion = appConfigVersion.match(type === 'major' ? /^(\d+\.\d+)/ : /^(\d+\.\d+\.\d+)/);
  if (!cleanedAppConfigVersion) {
    throw new Error('Invalid app version');
  }
  const version = cleanedAppConfigVersion[1];

  const sourceFile = await readFile(pathJoin(__dirname, `images/${type}.svg`), { encoding: 'utf-8' });

  const { getSvgElement } = await import('svg-text-to-path');
  const image = getSvgElement(sourceFile);
  if (!image) {
    throw new Error('Failed parsing input image');
  }

  // Remove <tspan> and move their attributes to the top level <text> elements
  // This is needed as svg-text-to-path does not handle <tspan> correctly
  image.querySelectorAll('text').forEach(element => {
    const tspan = element.querySelector('tspan');
    if (!tspan) {
      return;
    }

    element.setAttribute('x', tspan.getAttribute('x')!);
    element.setAttribute('y', tspan.getAttribute('y')!);

    element.textContent = tspan.textContent;
  });

  const versionText = image.querySelector('#version');
  if (!versionText) {
    throw new Error('Failed finding the version text element');
  }

  versionText.textContent = version;

  if (type === 'beta') {
    const revisionText = image.querySelector('#revision');
    const betaText = image.querySelector('#beta');
    if (!revisionText || !betaText) {
      throw new Error('Failed finding the revision text elements');
    }

    revisionText.textContent = revision;

    // Manually kern the beta revision text over to the left for some numbers
    // as they are slimmer in Inter
    // This is not perfect as everything is not centered, but it's good enough
    const minorAndPatch = appConfigVersion.match(/^\d+\.(\d+).(\d+)/);
    if (minorAndPatch) {
      const minor = minorAndPatch[1];
      const patch = minorAndPatch[2];

      let offset = 0;
      if (minor === '1') {
        offset += 12.65;
      } else if (minor === '7') {
        offset += 8;
      }
      if (patch === '1') {
        offset += 12.65;
      } else if (minor === '7') {
        offset += 8;
      }

      betaText.setAttribute('x', String(Number(betaText.getAttribute('x')) - offset));
      revisionText.setAttribute('x', String(Number(revisionText.getAttribute('x')) - offset));
    }
  }

  await renderSVG(image.outerHTML);
}

const fontMap: {
  [family: string | number]: {
    [weight: string | number]: string;
  };
} = {
  Inter: {
    200: pathResolve(pathJoin(__dirname, 'fonts/Inter-ExtraLight.otf')),
    300: pathResolve(pathJoin(__dirname, 'fonts/Inter-Light.otf')),
    700: pathResolve(pathJoin(__dirname, 'fonts/Inter-Bold.otf')),
    900: pathResolve(pathJoin(__dirname, 'fonts/Inter-Black.otf')),
  },
};

async function renderSVG(svgData: string) {
  const { replaceAllInString } = await import('svg-text-to-path');
  const convertedTextToPathsSvgData = await replaceAllInString(svgData, {
    onFontNotFound: 'error',
    handlers: [
      (style: { family: string | number; wght: string | number }) => {
        return fontMap[style.family]?.[style.wght];
      },
    ],
  });

  const optimizedSvg = optimize(convertedTextToPathsSvgData, {
    multipass: true,
  }) as OptimizedSvg;
  if (optimizedSvg.error) {
    throw new Error('Error optimizing svg: ' + optimizedSvg.error);
  }

  await writeFile(`./${appConfigVersion}.svg`, optimizedSvg.data);
}

main()
  .then()
  .catch((error: Error) => {
    console.error(error);
    process.exit(1);
  });
