/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IDisposable } from "../Disposable";
import { OmniSharpServer } from "../omnisharp/server";
import * as coc from 'coc.nvim';
import CompositeDisposable from "../CompositeDisposable";
import * as serverUtils from '../omnisharp/utils';
import { isVirtualCSharpDocument } from "./virtualDocumentTracker";

export default function fileOpenClose(server: OmniSharpServer): IDisposable {
    return new FileOpenCloseProvider(server);
}

class FileOpenCloseProvider implements IDisposable {
    private _server: OmniSharpServer;
    private _diagnostics: coc.DiagnosticCollection;
    private _disposable: CompositeDisposable;

    constructor(server: OmniSharpServer) {
        this._server = server;
        this._diagnostics = coc.languages.createDiagnosticCollection('csharp');

        setTimeout(async () => {
            for (let editor of coc.window.visibleTextEditors) {
                let document = editor.document;

                await this._onDocumentOpen(document.textDocument);
            }
        }, 0);

        this._disposable = new CompositeDisposable(this._diagnostics,
            coc.workspace.onDidOpenTextDocument(this._onDocumentOpen, this),
            coc.workspace.onDidCloseTextDocument(this._onDocumentClose, this),
            coc.window.onDidChangeActiveTextEditor(this._onActiveTextEditorChange, this)
        );
    }

    private async _onDocumentOpen(e: coc.TextDocument) {
        if (shouldIgnoreDocument(e)) {
            return;
        }

        await serverUtils.fileOpen(this._server, { FileName: coc.Uri.parse(e.uri).fsPath });
    }

    private async _onDocumentClose(e: coc.TextDocument) {
        if (shouldIgnoreDocument(e)) {
            return;
        }

        await serverUtils.fileClose(this._server, { FileName: coc.Uri.parse(e.uri).fsPath });
    }

    private async _onActiveTextEditorChange(e: coc.TextEditor | undefined) {
        if (e === undefined || shouldIgnoreDocument(e.document.textDocument)) {
            return;
        }

        // This handler is attempting to alert O# that the current file has changed and
        // to update diagnostics. This is necessary because O# does not recompute all diagnostics
        // for the projects affected when code files are changed. We want to at least provide
        // up to date diagnostics for the active document.
        //
        // The filesChanges service notifies O# that files have changed on disk. This causes
        // the document to be reloaded from disk. If there were unsaved changes in VS Code then
        // the server is no longer aware of those changes. This is not a good fit for our needs.
        //
        // Instead we will update the buffer for the current document which causes diagnostics to be
        // recomputed.
        await serverUtils.updateBuffer(
            this._server,
            {
                FileName: coc.Uri.parse(e.document.uri).fsPath,
                Buffer: e.document.getDocumentContent()
            }
        );
    }

    dispose = () => this._disposable.dispose();
}

function shouldIgnoreDocument(document: coc.TextDocument) {
    if (document.languageId !== 'csharp') {
        return true;
    }

    if (coc.Uri.parse(document.uri).scheme !== 'file' &&
        !isVirtualCSharpDocument(document)) {
        return true;
    }

    return false;
}
