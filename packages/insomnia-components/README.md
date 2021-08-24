# insomnia-components

`insomnia-components` is a React component library of UI elements needed to build [Insomnia](https://insomnia.rest). Explore the components via [Storybook](https://storybook.insomnia.rest)!

## SVGs

We use [SVGR](https://react-svgr.com) on the source SVGs to minify and convert them to React components. This conversion happens during `npm run bootstrap`.

The generated icons can automatically be bound to the theme library built into Insomnia, by following a few rules. In the source SVG:

1. All background colors should be black (#000)
1. All foreground colors should be white (#FFF)

SVGR converts these colors to `fill=''` and `fill='currentColor'` respectively. These icons are exposed via `svg-icon.js`, which sets the css `fill` and `color` of the SVG according to the required theme.

You can view the current icons available [here](https://storybook.insomnia.rest/?path=/story/svgicon--reference).
