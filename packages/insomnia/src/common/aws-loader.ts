import { GetParametersCommand, GetParametersCommandInput, SSMClient } from '@aws-sdk/client-ssm';
import { Environment } from '../models/environment';

type EnvironmentData = {
  [key: string]: any;
};

type EnvironmentContent = {
  key: string;
  value: string;
};

async function getAWSParameterValues(environmentContents: EnvironmentContent[]): Promise<Map<string, string>> {
  try {
    const awsPaths = environmentContents.map((path) => path.value.replace('aws', ''));
    const ssm = new SSMClient({ region: 'eu-central-1' });
    const input: GetParametersCommandInput = {
      Names: awsPaths,
      WithDecryption: true,
    };
    const command = new GetParametersCommand(input);

    const response = await ssm.send(command);
    const environmentMap = new Map<string, string>();

    awsPaths.forEach((awsPath: string, index): void => {
      const awsParameter = response.Parameters?.find((p) => p.Name === awsPath);
      environmentMap.set(environmentContents[index].key, awsParameter?.Value ?? '');
    });

    return environmentMap;
  } catch (error) {
    console.error(`Failed to fetch values for paths ${environmentContents.join(', ')}: ${error}`);
    throw error;
  }
}

async function fetchAwsParameterValues(environmentData: EnvironmentData): Promise<Map<string, string>> {
  const awsPaths: EnvironmentContent[] = Object.entries(environmentData)
    .filter(([, value]) => typeof value === 'string' && value.includes('aws/'))
    .map(([key, value]) => {
      return { key, value: value as string };
    });
  return await getAWSParameterValues(awsPaths);
}

function isAwsParameter(environmentData: EnvironmentData): boolean {
  const result = Object.entries(environmentData).filter(([, value]) => typeof value === 'string' && value.includes('aws/'));
  return result.length > 0;
}

export async function updateEnvWithAWS(environment: Environment) {
  if (!isAwsParameter(environment.data)) {
    return;
  }
  const awsParameters = await fetchAwsParameterValues(environment.data);
  Object.entries(environment.data).forEach((env: EnvironmentData) => {
    const environmentKey = env[0];
    if (!awsParameters.has(environmentKey)) {
      return;
    }
    environment.data[environmentKey] = awsParameters.get(environmentKey);
  });
}
