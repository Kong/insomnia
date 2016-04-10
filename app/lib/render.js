import swig from 'swig'

export default function (template, context) {
  return swig.render(template, {
    locals: context
  })
}
