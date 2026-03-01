import * as vscode from 'vscode';
import { JjCli } from './jjCli';
import * as path from 'path';

export class JjScmProvider {
    private scm: vscode.SourceControl;
    private workingTreeGroup: vscode.SourceControlResourceGroup;

    constructor(private extensionContext: vscode.ExtensionContext, private workspaceRoot: string, private jjCli: JjCli) {
        this.scm = vscode.scm.createSourceControl('jj', 'Jujutsu', vscode.Uri.file(workspaceRoot));
        this.workingTreeGroup = this.scm.createResourceGroup('workingTree', 'Changes');

        // Quick open diff setup can be handled here or globally
        this.scm.quickDiffProvider = new JjQuickDiffProvider(this.jjCli);

        this.scm.inputBox.placeholder = "Message (Commit / Describe)";
        this.scm.acceptInputCommand = { command: 'jj-lens.commit', title: 'Commit' };

        this.extensionContext.subscriptions.push(this.scm);
    }

    getCommitMessage(): string {
        return this.scm.inputBox.value;
    }

    clearCommitMessage() {
        this.scm.inputBox.value = '';
    }

    async refresh() {
        try {
            const changes = await this.jjCli.getStatus();
            const resourceStates: vscode.SourceControlResourceState[] = changes.map(change => {
                const fileUri = vscode.Uri.file(path.join(this.workspaceRoot, change.path));

                return {
                    resourceUri: fileUri,
                    decorations: {
                        strikeThrough: change.status === 'D',
                        tooltip: `State: ${change.status}`
                    },
                    command: {
                        title: "Open Changes",
                        command: "jj-lens.openChange",
                        arguments: [fileUri, change.status]
                    }
                };
            });

            this.workingTreeGroup.resourceStates = resourceStates;
        } catch (e: any) {
            console.error('jj-lens SCM Refresh Failed:', e.message);
        }
    }
}

class JjQuickDiffProvider implements vscode.QuickDiffProvider {
    constructor(private jjCli: JjCli) { }

    provideOriginalResource(uri: vscode.Uri, token: vscode.CancellationToken): vscode.ProviderResult<vscode.Uri> {
        // We'll provide a URI with a custom scheme like `jj:` to fetch the base file
        // that TextDocumentContentProvider will resolve.
        return vscode.Uri.parse(`jj:${uri.fsPath}`);
    }
}
