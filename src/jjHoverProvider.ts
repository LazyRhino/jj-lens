import * as vscode from 'vscode';
import { JjCli } from './jjCli';

export class JjHoverProvider implements vscode.HoverProvider {
    constructor(private jjCli: JjCli) { }

    async provideHover(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): Promise<vscode.Hover | null> {
        // Find the last commit that touched this line
        // jj log --limit 1 -T "commit_id.short() ++ ' ' ++ author.name() ++ ' ' ++ description.first_line()" <file> can be used,
        // but it doesn't support line-specific blame directly without `jj file annotate` / `jj blame`, which isn't widely supported natively yet.
        // As a fallback, we fetch the `jj log` for the file as a whole.

        const path = document.uri.fsPath;
        try {
            // First we try to see if jj file annotate exists/works if present, or just use jj log for the file.
            // A simplified line history: we just show the last person who modified this FILE for now.
            // If the user wants line-specific, `jj blame` or `jj annotate` are not standard commands yet, though `jj diff --stat` exists.

            // For now, let's fetch the log of the file up to 5 commits or just the latest commit to the file.
            const logOutput = await this.jjCli.getFileHistory(path);

            if (!logOutput) {
                return null;
            }

            const markdown = new vscode.MarkdownString();
            markdown.isTrusted = true;
            markdown.appendMarkdown(`**Jujutsu History for this file:**\n\n`);
            markdown.appendCodeblock(logOutput, 'text');

            return new vscode.Hover(markdown);
        } catch (e) {
            return null;
        }
    }
}
