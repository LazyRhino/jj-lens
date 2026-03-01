import * as vscode from 'vscode';
import { JjCli } from './jjCli';

export class JjDocumentProvider implements vscode.TextDocumentContentProvider {
    static scheme = 'jj';

    constructor(private jjCli: JjCli) { }

    async provideTextDocumentContent(uri: vscode.Uri, token: vscode.CancellationToken): Promise<string> {
        // The URI should be something like jj:/path/to/file
        // And optionally a query string for the revision, e.g. jj:/path/to/file?rev=@-
        // We'll use @- (the parent of the working copy) as the base for diffing the working copy.

        let path = uri.fsPath;
        if (uri.path) {
            path = uri.path;
        }

        let rev = '@-';
        if (uri.query) {
            const params = new URLSearchParams(uri.query);
            if (params.has('rev')) {
                rev = params.get('rev')!;
            }
        }

        try {
            return await this.jjCli.getFileContents(rev, path);
        } catch (e) {
            return '';
        }
    }
}
