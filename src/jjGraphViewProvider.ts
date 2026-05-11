import * as vscode from 'vscode';
import { JjCli } from './jjCli';
import { JjShowProvider } from './jjShowProvider';

export class JjGraphViewProvider implements vscode.WebviewViewProvider {
    private _view?: vscode.WebviewView;

    constructor(
        private readonly extensionUri: vscode.Uri,
        private readonly jjCli: JjCli
    ) {}

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this.extensionUri]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        webviewView.webview.onDidReceiveMessage(async (data) => {
            switch (data.command) {
                case 'showCommit': {
                    const changeId = data.changeId;
                    const uri = vscode.Uri.parse(`${JjShowProvider.scheme}:${changeId}`);
                    const doc = await vscode.workspace.openTextDocument(uri);
                    await vscode.window.showTextDocument(doc, { preview: true });
                    break;
                }
            }
        });

        // Initial load
        this.refresh();
    }

    public async refresh() {
        if (!this._view) {
            return;
        }

        try {
            // Retrieve graph
            // Use our structured template with commit tag delimiters
            const template = '"⟨commit|" ++ change_id.short() ++ "⟩" ++ change_id.short() ++ " " ++ author.name() ++ " " ++ description.first_line() ++ "\\n"';
            const rawLog = await this.jjCli.getLogGraph(template);
            
            // Format to HTML lines
            const parsedLines = this.parseLogToHtml(rawLog);

            this._view.webview.postMessage({ command: 'updateGraph', html: parsedLines });
        } catch (e: any) {
            this._view.webview.postMessage({ command: 'updateGraph', html: `<div style="padding: 10px; color: var(--vscode-errorForeground);">Failed to fetch graph: ${e.message}</div>` });
        }
    }

    private parseLogToHtml(rawLog: string): string {
        const rawLines = rawLog.split('\n');
        return rawLines.map(line => {
            if (!line) {
                return '';
            }
            
            const commitMatch = line.match(/⟨commit\|(\w+)⟩/);
            if (commitMatch) {
                const changeId = commitMatch[1];
                // Remove the tag from the output
                const cleanLine = line.replace(/⟨commit\|(\w+)⟩/, '');
                const htmlLine = this.ansiToHtml(cleanLine);
                return `<div class="graph-line commit-row" data-id="${changeId}" title="Click to view details of commit ${changeId}">${htmlLine}</div>`;
            } else {
                const htmlLine = this.ansiToHtml(line);
                return `<div class="graph-line info-row">${htmlLine}</div>`;
            }
        }).join('\n');
    }

    private ansiToHtml(text: string): string {
        // Escape HTML
        let escaped = text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

        const ansiRegex = /[\u001b\x1B]\[([0-9;]*)[mK]/g;
        let openSpans = 0;

        escaped = escaped.replace(ansiRegex, (match, p1) => {
            if (!p1 || p1 === '0' || p1 === '') {
                let res = '';
                while (openSpans > 0) {
                    res += '</span>';
                    openSpans--;
                }
                return res;
            }

            const codes = p1.split(';');
            const styles: string[] = [];

            for (const code of codes) {
                const num = parseInt(code, 10);
                if (num === 1) {
                    styles.push('font-weight: bold;');
                } else if (num === 2) {
                    styles.push('opacity: 0.7;');
                } else if (num === 3) {
                    styles.push('font-style: italic;');
                } else if (num === 4) {
                    styles.push('text-decoration: underline;');
                } else if (num >= 30 && num <= 37) {
                    const colors = ['black', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white'];
                    styles.push(`color: var(--vscode-terminal-ansi${capitalize(colors[num - 30])}, ${colors[num - 30]});`);
                } else if (num >= 90 && num <= 97) {
                    const colors = ['BrightBlack', 'BrightRed', 'BrightGreen', 'BrightYellow', 'BrightBlue', 'BrightMagenta', 'BrightCyan', 'BrightWhite'];
                    styles.push(`color: var(--vscode-terminal-ansi${colors[num - 90]});`);
                } else if (num >= 40 && num <= 47) {
                    const colors = ['black', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white'];
                    styles.push(`background-color: var(--vscode-terminal-ansi${capitalize(colors[num - 40])});`);
                } else if (num >= 100 && num <= 107) {
                    const colors = ['BrightBlack', 'BrightRed', 'BrightGreen', 'BrightYellow', 'BrightBlue', 'BrightMagenta', 'BrightCyan', 'BrightWhite'];
                    styles.push(`background-color: var(--vscode-terminal-ansi${colors[num - 100]});`);
                }
            }

            if (styles.length > 0) {
                openSpans++;
                return `<span style="${styles.join(' ')}">`;
            }
            return '';
        });

        while (openSpans > 0) {
            escaped += '</span>';
            openSpans--;
        }

        return escaped;
    }

    private _getHtmlForWebview(webview: vscode.Webview): string {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Jujutsu Graph</title>
    <style>
        body {
            background-color: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            font-family: var(--vscode-editor-font-family, monospace);
            font-size: var(--vscode-editor-font-size, 12px);
            padding: 8px;
            margin: 0;
            white-space: pre;
            overflow-x: auto;
            user-select: none;
        }
        #graph-container {
            display: flex;
            flex-direction: column;
        }
        .graph-line {
            line-height: 1.5;
            padding: 1px 4px;
            border-radius: 3px;
        }
        .commit-row {
            cursor: pointer;
            transition: background-color 0.15s ease;
        }
        .commit-row:hover {
            background-color: var(--vscode-list-hoverBackground);
            color: var(--vscode-list-hoverForeground, var(--vscode-editor-foreground));
        }
        .info-row {
            opacity: 0.85;
        }
    </style>
</head>
<body>
    <div id="graph-container">Loading Jujutsu Graph...</div>

    <script>
        const vscode = acquireVsCodeApi();
        const container = document.getElementById('graph-container');

        window.addEventListener('message', event => {
            const message = event.data;
            switch (message.command) {
                case 'updateGraph':
                    container.innerHTML = message.html;
                    
                    // Attach click handlers to commit rows
                    document.querySelectorAll('.commit-row').forEach(row => {
                        row.addEventListener('click', () => {
                            const changeId = row.getAttribute('data-id');
                            if (changeId) {
                                vscode.postMessage({ command: 'showCommit', changeId });
                            }
                        });
                    });
                    break;
            }
        });
    </script>
</body>
</html>`;
    }
}

function capitalize(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
}
