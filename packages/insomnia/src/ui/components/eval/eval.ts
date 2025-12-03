const TEST_DATA = [
  { ticket_text: "My monitor won't turn on!", correct_label: 'Hardware' },
  // { ticket_text: "I'm in vim and I can't quit!", correct_label: 'Software' },
  // { ticket_text: 'Best restaurants in Cleveland?', correct_label: 'Other' },
  { ticket_text: 'The printer is jammed again.', correct_label: 'Software' }, // wrong
];
const TESTING_CRITERIA = {
  name: 'Match output to human label',
  id: 'Match output to human label-c4fdf789-2fa5-407f-8a41-a6f4f9afd482',
  type: 'string_check',
  input: '{{ sample.output_text }}',
  reference: '{{ item.correct_label }}',
  operation: 'eq',
};
const SCHEMA = {
  type: 'custom',
  item_schema: {
    type: 'object',
    properties: {
      ticket: { type: 'string' },
      category: { type: 'string' },
    },
    required: ['ticket', 'category'],
  },
  include_sample_schema: true,
};
const PROMPT = [
  {
    role: 'user',
    content: `You are an AI assistant that helps the IT department categorize support tickets into one of three categories: Hardware, Software, or Other. Respond with just the category name. 
      Categorize the following support ticket: "{{ item.ticket_text }}"`,
  },
];
export const evalFormData = {
  data_source_config: JSON.stringify(SCHEMA, null, 2),
  testing_criteria: JSON.stringify(TESTING_CRITERIA, null, 2),
  test_data: JSON.stringify(TEST_DATA, null, 2),
  prompt: JSON.stringify(PROMPT, null, 2),
};

const API_KEY = '';

async function callLLM(prompt: any) {
  const url = 'https://api.anthropic.com/v1/messages';

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'x-api-key': API_KEY as string,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 1024,
        messages: prompt,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`HTTP error! status: ${response.status}, message: ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();
    console.log('Response:', data);
    return data;
  } catch (error) {
    console.error('Request failed:', error);
  }
}

function getValueByPath(obj: any, path: string) {
  const parts = path.split('.');
  let current = obj;
  for (const part of parts) {
    console.log('Path:', path, current, current[part]);
    if (current && current[part] != null) {
      current = current[part];
    } else {
      console.log('Path not found:', path);
      return undefined;
    }
  }
  return current;
}

function resolveArgument(arg, sample, answer) {
  if (/\s*\{\{\s*sample\.output_text\s*\}\}/.test(arg)) {
    return sample.content?.[0].text;
  }
  const match = arg.match(/\s*\{\{\s*item\.([^\}\s]+)\s*\}\}/);
  if (match) {
    console.log('Resolving argument:', arg, 'to', match[1], 'from answer:', answer);
    return getValueByPath(answer, match[1]);
  }
}

const testImpl = [
  {
    test: criteria => criteria.type === 'string_check' && criteria.operation === 'eq',
    handler(config, sample, answer) {
      const input = resolveArgument(config.input, sample, answer);
      const reference = resolveArgument(config.reference, sample, answer);
      console.log('Comparing input:', input, 'with reference:', reference, answer);
      return {
        expected: reference,
        actual: input,
        passed: input === reference,
      };
    },
  },
];

export const runCriteria = async (criteria: any, sample: any, answer: any) => {
  const impl = testImpl.find(i => i.test(criteria));
  if (impl) {
    return impl.handler(criteria, sample, answer);
  }
  return false;
};

export const runEval = async () => {
  const report = [];
  for (const item of window.testai_TEST_DATA || TEST_DATA) {
    const prompt =
      window.testai_PROMPT ||
      PROMPT.map(part => {
        if (part.role === 'user') {
          return {
            role: part.role,
            content: part.content.replace('{{ item.ticket_text }}', item.ticket_text),
          };
        }
        return part;
      });
    const res = await callLLM(prompt);
    const passed = await runCriteria(window.testai_TESTING_CRITERIA || TESTING_CRITERIA, res, item);
    report.push({
      sample: res,
      status: (typeof passed === 'boolean' ? passed : passed.passed) ? 'passed' : 'failed',
      answer: item,
      ...passed,
    });
  }
  console.log('Final Report:', report);
  return report;
};
