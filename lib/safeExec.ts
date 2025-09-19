import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

export const execFileAsync = promisify(execFile);

// Safe execution with timeout and buffer limits
export async function safeExecute(
  command: string,
  args: string[],
  options?: {
    timeout?: number;
    maxBuffer?: number;
    cwd?: string;
    env?: NodeJS.ProcessEnv;
  }
) {
  const defaultOptions = {
    timeout: 30000, // 30 seconds
    maxBuffer: 50 * 1024 * 1024, // 50MB
    ...options
  };

  try {
    const result = await execFileAsync(command, args, defaultOptions);
    return result;
  } catch (error: any) {
    // Sanitize error messages to avoid leaking sensitive paths
    if (error.code === 'ETIMEDOUT') {
      throw new Error('Command execution timeout');
    }
    if (error.code === 'ENOENT') {
      throw new Error('Command not found');
    }
    if (error.signal === 'SIGKILL') {
      throw new Error('Process killed due to resource limits');
    }
    throw new Error(`Command execution failed: ${error.message}`);
  }
}