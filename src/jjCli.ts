import * as cp from 'child_process';
import * as vscode from 'vscode';

export class JjCli {
    constructor(private workspaceRoot: string) { }

    private async execute(args: string[]): Promise<string> {
        return new Promise<string>((resolve, reject) => {
            cp.execFile('jj', args, { cwd: this.workspaceRoot, maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
                if (error) {
                    reject(new Error(`JJ Error: ${error.message}\nStderr: ${stderr}`));
                } else {
                    resolve(stdout);
                }
            });
        });
    }

    /**
     * Gets the current working copy changes by parsing `jj diff --summary`
     * Usually looks like:
     * M package.json
     * A src/new_file.ts
     * D old_file.txt
     */
    async getStatus(): Promise<{ status: string; path: string }[]> {
        const output = await this.execute(['diff', '--summary']);
        const lines = output.split('\n');
        const changes: { status: string; path: string }[] = [];

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;

            // Format is "M path/to/file.ext"
            const parts = trimmed.split(' ');
            if (parts.length >= 2) {
                const status = parts[0];
                const path = parts.slice(1).join(' '); // Rejoin in case of spaces in filepath
                changes.push({ status, path });
            }
        }

        return changes;
    }

    async getFileContents(revision: string, filePath: string): Promise<string> {
        try {
            return await this.execute(['file', 'show', '-r', revision, filePath]);
        } catch (e) {
            // If file represents a deletion or doesn't exist in that revision
            return '';
        }
    }

    async describe(message: string): Promise<string> {
        return await this.execute(['describe', '-m', message]);
    }

    async commit(message: string): Promise<string> {
        return await this.execute(['commit', '-m', message]);
    }

    async getFileHistory(filePath: string): Promise<string> {
        return await this.execute(['log', '--limit', '5', '-T', 'commit_id.short() ++ " " ++ author.name() ++ " " ++ description.first_line() ++ "\\n"', filePath]);
    }
}
