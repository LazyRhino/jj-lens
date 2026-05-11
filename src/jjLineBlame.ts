import * as vscode from 'vscode';
import { JjCli } from './jjCli';

interface BlameLine {
    changeId: string;
    author: string;
    ago: string;
    description: string;
}

export class JjLineBlameController implements vscode.Disposable {
    private disposables: vscode.Disposable[] = [];
    private blameCache = new Map<string, BlameLine[]>();
    private pendingFetches = new Set<string>();

    private blameDecorationType = vscode.window.createTextEditorDecorationType({
        after: {
            margin: '0 0 0 3em',
            textDecoration: 'none;',
            fontStyle: 'italic',
            color: new vscode.ThemeColor('editorGhostText.foreground'),
        }
    });

    constructor(private jjCli: JjCli) {
        this.disposables.push(
            vscode.window.onDidChangeActiveTextEditor(editor => {
                this.clearDecoration(editor);
                if (editor) {
                    this.updateBlame(editor);
                }
            }),
            vscode.window.onDidChangeTextEditorSelection(e => {
                this.updateBlame(e.textEditor);
            }),
            vscode.workspace.onDidChangeTextDocument(e => {
                const fsPath = e.document.uri.fsPath;
                this.blameCache.delete(fsPath);
                // Clear active decoration if it's the active editor
                const activeEditor = vscode.window.activeTextEditor;
                if (activeEditor && activeEditor.document === e.document) {
                    this.clearDecoration(activeEditor);
                }
            }),
            vscode.workspace.onDidSaveTextDocument(doc => {
                this.blameCache.delete(doc.uri.fsPath);
                const activeEditor = vscode.window.activeTextEditor;
                if (activeEditor && activeEditor.document === doc) {
                    this.updateBlame(activeEditor);
                }
            })
        );

        // Initial update
        if (vscode.window.activeTextEditor) {
            this.updateBlame(vscode.window.activeTextEditor);
        }
    }

    public clearCache() {
        this.blameCache.clear();
        if (vscode.window.activeTextEditor) {
            this.updateBlame(vscode.window.activeTextEditor);
        }
    }

    private clearDecoration(editor: vscode.TextEditor | undefined) {
        if (editor) {
            editor.setDecorations(this.blameDecorationType, []);
        }
    }

    private async updateBlame(editor: vscode.TextEditor) {
        const config = vscode.workspace.getConfiguration('jj-lens');
        const enabled = config.get<boolean>('inlineBlame', true);
        if (!enabled) {
            this.clearDecoration(editor);
            return;
        }

        const doc = editor.document;
        // Only run for files on disk (file:// scheme)
        if (doc.uri.scheme !== 'file') {
            this.clearDecoration(editor);
            return;
        }

        const selection = editor.selection;
        const lineNumber = selection.active.line;

        const fsPath = doc.uri.fsPath;
        let lines = this.blameCache.get(fsPath);

        if (!lines) {
            if (this.pendingFetches.has(fsPath)) {
                return;
            }
            this.pendingFetches.add(fsPath);

            try {
                const output = await this.jjCli.annotate(fsPath);
                const parsedLines: BlameLine[] = [];
                const outputLines = output.split('\n');
                
                for (const outLine of outputLines) {
                    if (!outLine.trim()) {
                        continue;
                    }
                    const parts = outLine.split('\t');
                    if (parts.length >= 3) {
                        parsedLines.push({
                            changeId: parts[0],
                            author: parts[1],
                            ago: parts[2],
                            description: parts[3] || ''
                        });
                    }
                }
                
                this.blameCache.set(fsPath, parsedLines);
                lines = parsedLines;
            } catch (e) {
                // If file is untracked or has no history, etc.
                this.blameCache.set(fsPath, []);
            } finally {
                this.pendingFetches.delete(fsPath);
            }
        }

        // Check if editor is still active/focused on the same document
        if (vscode.window.activeTextEditor !== editor || editor.document !== doc) {
            return;
        }

        if (!lines || lines.length === 0 || lineNumber >= lines.length) {
            this.clearDecoration(editor);
            return;
        }

        const blame = lines[lineNumber];
        if (!blame) {
            this.clearDecoration(editor);
            return;
        }

        const author = blame.author || 'Unknown';
        const ago = blame.ago || '';
        const desc = blame.description || '';
        const truncatedDesc = desc.length > 55 ? desc.substring(0, 52) + '...' : desc;

        const blameText = `• ${author}, ${ago} — ${truncatedDesc}`;

        const line = doc.lineAt(lineNumber);
        const decorationRange = new vscode.Range(lineNumber, line.text.length, lineNumber, line.text.length);

        editor.setDecorations(this.blameDecorationType, [{
            range: decorationRange,
            renderOptions: {
                after: {
                    contentText: `   ${blameText}`
                }
            }
        }]);
    }

    dispose() {
        this.clearDecoration(vscode.window.activeTextEditor);
        this.disposables.forEach(d => d.dispose());
        this.blameDecorationType.dispose();
    }
}
