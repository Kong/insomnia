import { strings } from 'insomnia-data/common';

export const interceptAccessError = async <T>({
  callback,
  action,
  resourceName,
  resourceType = strings.collection.singular.toLowerCase(),
}: {
  callback: () => T | Promise<T>;
  action: string;
  resourceName: string;
  resourceType?: string;
}) => {
  try {
    return await callback();
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes('invalid access')) {
      throw new Error(
        `You no longer have permission to ${action} the "${resourceName}" ${resourceType}.  Contact your team administrator if you think this is an error.`,
      );
    }
    throw error;
  }
};
