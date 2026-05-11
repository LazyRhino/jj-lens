import * as vscode from 'vscode';
import { JjCli } from './jjCli';

export class JjShowProvider implements vscode.TextDocumentContentProvider {
    static scheme = 'jj-show';

    constructor(private jjCli: JjCli) {}

    async provideTextDocumentContent(uri: vscode.Uri, token: vscode.CancellationToken): Promise<string> {
        // The URI is structured as jj-show:changeId
        const changeId = uri.path;
        if (!changeId) {
            return 'No change ID specified.';
        }
        try {
            return await this.jjCli.show(changeId);
        } catch (e: any) {
            return `Failed to show commit ${changeId}:\n${e.message}`;
        }
    }
}
