import { readFile, writeFile } from 'fs/promises';
import path from 'path';

/**
 * JSON 文件解析工具类
 * 适用于类似 {"a":1, "b":2} 的简单 JSON 文件
 */
export class FileHelper {
  private constructor() {}

  static async loadSmokeTestData<T = Record<string, any>>(tsFileName: string): Promise<T> {
    const filePath = path.join(__dirname, '..', '..', 'fixtures', 'smoke', tsFileName+'.json')
    return await FileHelper.read(filePath)
  }


  /**
   * 读取 JSON 文件
   */
  static async read<T = Record<string, any>>(filePath: string): Promise<T> {
    try {
      const content = await readFile(filePath, 'utf8');
      return JSON.parse(content) as T;
    } catch (error) {
      throw new Error(`读取 JSON 文件失败: ${filePath}`);
    }
  }

  /**
   * 安全读取 JSON 文件，失败返回空对象
   */
  static async readSafe<T = Record<string, any>>(filePath: string): Promise<T> {
    try {
      return await this.read<T>(filePath);
    } catch {
      return {} as T;
    }
  }

  /**
   * 写入 JSON 文件
   */
  static async write(filePath: string, data: Record<string, any>): Promise<void> {
    try {
      const content = JSON.stringify(data, null, 2);
      await writeFile(filePath, content, 'utf8');
    } catch (error) {
      throw new Error(`写入 JSON 文件失败: ${filePath}`);
    }
  }

  /**
   * 读取并获取指定字段的值
   */
  static async getValue<T>(filePath: string, key: string): Promise<T | undefined> {
    const data = await this.readSafe(filePath);
    return data[key] as T;
  }

  /**
   * 更新 JSON 文件的指定字段
   */
  static async updateValue(filePath: string, key: string, value: any): Promise<void> {
    const data = await this.readSafe(filePath);
    data[key] = value;
    await this.write(filePath, data);
  }
}
