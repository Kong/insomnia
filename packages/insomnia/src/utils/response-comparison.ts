import type {
  BaseComparisonResult,
  ComparisonSummary,
  DiffResult,
  HeaderDiff
} from '../models/comparison-result';
import type { ComparisonConfig } from '../models/environment-comparison';
import type { Response, ResponseHeader } from '../models/response';
import { getBodyBuffer } from '../models/response';

export class ResponseComparator {
  private config: ComparisonConfig;

  constructor(config: ComparisonConfig) {
    this.config = config;
  }

  async compare(
    sourceResponse: Response,
    targetResponse: Response,
    requestName: string
  ): Promise<Omit<BaseComparisonResult, 'parentId' | 'environmentComparisonId'>> {
    const [sourceBody, targetBody] = await Promise.all([
      this.getResponseBodyAsText(sourceResponse),
      this.getResponseBodyAsText(targetResponse),
    ]);

    const bodyDifferences = await this.compareResponseBodies(sourceBody, targetBody);
    const headerDifferences = this.compareHeaders(sourceResponse.headers, targetResponse.headers);

    // For JSON responses, count total fields by traversing the structure
    // For text responses, count lines
    // We need to count fields in BOTH responses to get the total universe of fields
    let totalFields = 0;
    try {
      const sourceJson = JSON.parse(sourceBody);
      const targetJson = JSON.parse(targetBody);
      const sourceFields = this.countTotalFields(sourceJson);
      const targetFields = this.countTotalFields(targetJson);
      // Use the larger count to represent the total universe of fields
      totalFields = Math.max(sourceFields, targetFields);
    } catch {
      // Not JSON, use line count
      totalFields = Math.max(
        sourceBody.split('\n').length,
        targetBody.split('\n').length
      );
    }

    const summary = this.generateSummary(
      bodyDifferences,
      headerDifferences,
      sourceResponse,
      targetResponse,
      totalFields
    );

    return {
      requestId: sourceResponse.parentId,
      requestName,
      sourceResponseId: sourceResponse._id,
      targetResponseId: targetResponse._id,
      sourceEnvironmentId: sourceResponse.environmentId || '',
      targetEnvironmentId: targetResponse.environmentId || '',
      bodyDifferences: this.applyIgnoreRules(bodyDifferences),
      headerDifferences: this.filterIgnoredHeaders(headerDifferences),
      summary,
      executedAt: Date.now(),
      sourceStatusCode: sourceResponse.statusCode,
      targetStatusCode: targetResponse.statusCode,
      sourceUrl: sourceResponse.url,
      targetUrl: targetResponse.url,
    };
  }

  private async getResponseBodyAsText(response: Response): Promise<string> {
    try {
      if (response.bodyBuffer) {
        return response.bodyBuffer.toString('utf8');
      }

      const bodyBuffer = await getBodyBuffer(response);
      return bodyBuffer.toString('utf8');
    } catch (error) {
      console.warn('Failed to read response body:', error);
      return '';
    }
  }

  private async compareResponseBodies(sourceBody: string, targetBody: string): Promise<DiffResult[]> {
    if (!sourceBody && !targetBody) {
      return [];
    }

    // Try to parse as JSON first
    try {
      const sourceJson = JSON.parse(sourceBody);
      const targetJson = JSON.parse(targetBody);
      return this.compareJsonObjects(sourceJson, targetJson, '');
    } catch {
      // Fallback to text comparison
      return this.compareTextBodies(sourceBody, targetBody);
    }
  }

  private compareJsonObjects(
    source: any,
    target: any,
    path = ''
  ): DiffResult[] {
    const differences: DiffResult[] = [];

    if (source === null && target === null) {
      return differences;
    }

    if (source === null) {
      differences.push({
        path,
        sourceValue: null,
        targetValue: target,
        type: 'added',
        severity: 'warning',
      });
      return differences;
    }

    if (target === null) {
      differences.push({
        path,
        sourceValue: source,
        targetValue: null,
        type: 'removed',
        severity: 'warning',
      });
      return differences;
    }

    if (typeof source !== typeof target) {
      differences.push({
        path,
        sourceValue: source,
        targetValue: target,
        type: 'modified',
        severity: 'critical',
      });
      return differences;
    }

    if (Array.isArray(source) && Array.isArray(target)) {
      return this.compareArrays(source, target, path);
    }

    if (typeof source === 'object' && source !== null && target !== null) {
      return this.compareObjects(source, target, path);
    }

    // Primitive comparison
    if (source !== target) {
      const severity = this.determineSeverity(source, target, path);
      differences.push({
        path,
        sourceValue: source,
        targetValue: target,
        type: 'modified',
        severity,
      });
    }

    return differences;
  }

  private compareObjects(source: any, target: any, basePath: string): DiffResult[] {
    const differences: DiffResult[] = [];
    const allKeys = new Set([...Object.keys(source), ...Object.keys(target)]);

    for (const key of allKeys) {
      const currentPath = basePath ? `${basePath}.${key}` : key;

      if (!(key in source)) {
        differences.push({
          path: currentPath,
          sourceValue: undefined,
          targetValue: target[key],
          type: 'added',
          severity: 'info',
        });
      } else if (!(key in target)) {
        differences.push({
          path: currentPath,
          sourceValue: source[key],
          targetValue: undefined,
          type: 'removed',
          severity: 'info',
        });
      } else {
        differences.push(...this.compareJsonObjects(source[key], target[key], currentPath));
      }
    }

    return differences;
  }

  private compareArrays(source: any[], target: any[], basePath: string): DiffResult[] {
    const differences: DiffResult[] = [];
    const maxLength = Math.max(source.length, target.length);

    for (let i = 0; i < maxLength; i++) {
      const currentPath = `${basePath}[${i}]`;

      if (i >= source.length) {
        differences.push({
          path: currentPath,
          sourceValue: undefined,
          targetValue: target[i],
          type: 'added',
          severity: 'info',
        });
      } else if (i >= target.length) {
        differences.push({
          path: currentPath,
          sourceValue: source[i],
          targetValue: undefined,
          type: 'removed',
          severity: 'info',
        });
      } else {
        differences.push(...this.compareJsonObjects(source[i], target[i], currentPath));
      }
    }

    return differences;
  }

  private compareTextBodies(sourceBody: string, targetBody: string): DiffResult[] {
    if (sourceBody === targetBody) {
      return [];
    }

    return [{
      path: 'body',
      sourceValue: sourceBody,
      targetValue: targetBody,
      type: 'modified',
      severity: 'warning',
    }];
  }

  private compareHeaders(
    sourceHeaders: ResponseHeader[],
    targetHeaders: ResponseHeader[]
  ): HeaderDiff[] {
    const differences: HeaderDiff[] = [];
    const sourceHeaderMap = new Map(
      sourceHeaders.map(h => [h.name.toLowerCase(), h.value])
    );
    const targetHeaderMap = new Map(
      targetHeaders.map(h => [h.name.toLowerCase(), h.value])
    );

    const allHeaderNames = new Set([
      ...sourceHeaderMap.keys(),
      ...targetHeaderMap.keys(),
    ]);

    for (const headerName of allHeaderNames) {
      const sourceValue = sourceHeaderMap.get(headerName);
      const targetValue = targetHeaderMap.get(headerName);

      if (sourceValue === undefined) {
        differences.push({
          name: headerName,
          targetValue,
          type: 'added',
        });
      } else if (targetValue === undefined) {
        differences.push({
          name: headerName,
          sourceValue,
          type: 'removed',
        });
      } else if (sourceValue !== targetValue) {
        differences.push({
          name: headerName,
          sourceValue,
          targetValue,
          type: 'modified',
        });
      }
    }

    return differences;
  }

  private determineSeverity(sourceValue: any, targetValue: any, path: string): 'critical' | 'warning' | 'info' {
    // Numbers with tolerance
    if (typeof sourceValue === 'number' && typeof targetValue === 'number') {
      const percentDiff = Math.abs((sourceValue - targetValue) / sourceValue) * 100;
      if (percentDiff <= this.config.tolerancePercent) {
        return 'info';
      }
      return percentDiff > 50 ? 'critical' : 'warning';
    }

    // Critical paths (customize based on your API needs)
    const criticalPaths = ['id', '_id', 'status', 'error', 'success'];
    if (criticalPaths.some(cp => path.includes(cp))) {
      return 'critical';
    }

    return 'warning';
  }

  private applyIgnoreRules(differences: DiffResult[]): DiffResult[] {
    if (this.config.ignoreFields.length === 0) {
      return differences;
    }

    return differences.filter(diff => {
      return !this.config.ignoreFields.some(ignoreField =>
        diff.path.includes(ignoreField)
      );
    });
  }

  private filterIgnoredHeaders(headerDifferences: HeaderDiff[]): HeaderDiff[] {
    if (this.config.ignoreHeaders.length === 0) {
      return headerDifferences;
    }

    return headerDifferences.filter(headerDiff => {
      return !this.config.ignoreHeaders.some(ignoreHeader =>
        headerDiff.name.toLowerCase().includes(ignoreHeader.toLowerCase())
      );
    });
  }

  private countTotalFields(obj: any): number {
    let count = 0;

    if (obj === null || obj === undefined) {
      return 0;
    }

    if (typeof obj !== 'object') {
      return 1; // Primitive value counts as 1 field
    }

    if (Array.isArray(obj)) {
      return obj.reduce((sum, item) => sum + this.countTotalFields(item), 0);
    }

    // Object: count each key-value pair
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        count += 1 + this.countTotalFields(obj[key]);
      }
    }

    return count;
  }

  private generateSummary(
    bodyDifferences: DiffResult[],
    _headerDifferences: HeaderDiff[],
    sourceResponse: Response,
    targetResponse: Response,
    totalFields: number
  ): ComparisonSummary {
    // Only count body differences - ignore headers since they're not relevant for comparison
    const totalDifferences = bodyDifferences.length;
    const criticalDifferences = bodyDifferences.filter(d => d.severity === 'critical').length;
    const warningDifferences = bodyDifferences.filter(d => d.severity === 'warning').length;

    const responseTimePercentDiff = sourceResponse.elapsedTime > 0
      ? Math.abs((sourceResponse.elapsedTime - targetResponse.elapsedTime) / sourceResponse.elapsedTime) * 100
      : 0;

    const responseSizePercentDiff = sourceResponse.bytesContent > 0
      ? Math.abs((sourceResponse.bytesContent - targetResponse.bytesContent) / sourceResponse.bytesContent) * 100
      : 0;

    // Calculate match percentage based on total fields/lines
    // Only use body differences (not headers) for the calculation
    // Each difference represents a field/path that doesn't match
    // totalFields represents all fields in the larger of the two structures
    // Match % = (fields that match) / (total fields) = (total - diffs) / total
    // However, if differences > totalFields, it means we're comparing paths not just leaf fields
    // In that case, we use an inverse calculation to avoid negative percentages
    let matchPercentage = 100;
    if (totalFields > 0) {
      if (totalDifferences > totalFields) {
        // More differences than fields suggests path-based diffs, use inverse calculation
        matchPercentage = Math.max(0, 100 - (totalDifferences / totalFields) * 100);
      } else {
        // Normal case: differences <= fields
        matchPercentage = ((totalFields - totalDifferences) / totalFields) * 100;
      }
      matchPercentage = Math.max(0, Math.min(100, matchPercentage));
    }

    return {
      totalDifferences,
      criticalDifferences,
      warningDifferences,
      statusCodeMatch: sourceResponse.statusCode === targetResponse.statusCode,
      responseTimeSource: sourceResponse.elapsedTime,
      responseTimeTarget: targetResponse.elapsedTime,
      responseTimePercentDiff,
      responseSizeSource: sourceResponse.bytesContent,
      responseSizeTarget: targetResponse.bytesContent,
      responseSizePercentDiff,
      matchPercentage,
    };
  }
}
