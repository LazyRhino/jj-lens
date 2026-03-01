import * as vscode from 'vscode';
import { JjScmProvider } from './jjScm';
import { JjDocumentProvider } from './jjDocumentProvider';
import { JjCli } from './jjCli';
import { JjHoverProvider } from './jjHoverProvider';

export function activate(context: vscode.ExtensionContext) {
    console.log('jj-lens is now active!');

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        return;
    }
    const rootPath = workspaceFolders[0].uri.fsPath;

    const jjCli = new JjCli(rootPath);
    const docProvider = new JjDocumentProvider(jjCli);
    const scmProvider = new JjScmProvider(context, rootPath, jjCli);

    // Register Document Provider
    context.subscriptions.push(
        vscode.workspace.registerTextDocumentContentProvider(JjDocumentProvider.scheme, docProvider)
    );

    // Initial load
    scmProvider.refresh();

    // Command: Open diff
    let openChangeDisposable = vscode.commands.registerCommand('jj-lens.openChange', (uri: vscode.Uri, status: string) => {
        // diff original resource vs working tree resource
        // The original resource is from jj:, modified is the local file
        const originalUri = vscode.Uri.parse(`jj:${uri.fsPath}`);

        const filename = uri.path.split('/').pop() || 'File';
        vscode.commands.executeCommand('vscode.diff', originalUri, uri, `${filename} (Working Copy)`);
    });

    // Command: explicit commit/describe
    let commitDisposable = vscode.commands.registerCommand('jj-lens.commit', async () => {
        const message = scmProvider.getCommitMessage();
        if (!message) {
            vscode.window.showErrorMessage("Please enter a message in the SCM input box.");
            return;
        }

        const config = vscode.workspace.getConfiguration('jj-lens');
        const commitAction = config.get<string>('commitAction', 'commit');

        try {
            if (commitAction === 'describe') {
                await jjCli.describe(message);
                vscode.window.showInformationMessage(`Described: ${message}`);
            } else {
                await jjCli.commit(message);
                vscode.window.showInformationMessage(`Committed: ${message}`);
            }

            scmProvider.clearCommitMessage();
            scmProvider.refresh();
        } catch (e: any) {
            vscode.window.showErrorMessage(`JJ Action failed: ${e.message}`);
        }
    });

    // Command: split
    let splitDisposable = vscode.commands.registerCommand('jj-lens.split', () => {
        // For VS Code extension we might just open a terminal and run `jj split`
        // as `jj split` requires an interactive session
        const terminal = vscode.window.createTerminal('jj split');
        terminal.show();
        terminal.sendText('jj split');
    });

    // Watch for file changes using RelativePattern to respect files.watcherExclude
    // Using a plain string '**/*' causes VS Code to bypass exclusions, exhausting inotify handles in WSL.
    const watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(workspaceFolders[0], '**/*'));
    let refreshTimeout: NodeJS.Timeout | undefined;

    const debouncedRefresh = (uri: vscode.Uri) => {
        // Ignore .jj directory and node_modules entirely
        if (uri.fsPath.includes('.jj') || uri.fsPath.includes('node_modules')) {
            return;
        }

        if (refreshTimeout) {
            clearTimeout(refreshTimeout);
        }
        refreshTimeout = setTimeout(() => {
            scmProvider.refresh();
        }, 500); // 500ms debounce
    };

    watcher.onDidChange(debouncedRefresh);
    watcher.onDidCreate(debouncedRefresh);
    watcher.onDidDelete(debouncedRefresh);

    // Register Hover Provider
    const hoverProvider = new JjHoverProvider(jjCli);
    const hoverDisposable = vscode.languages.registerHoverProvider('*', hoverProvider);

    context.subscriptions.push(openChangeDisposable, commitDisposable, splitDisposable, watcher, hoverDisposable);
}

export function deactivate() { }
