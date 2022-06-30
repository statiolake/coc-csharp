/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'coc.nvim';
import { Uri } from 'coc.nvim';
import { LanguageMiddlewareFeature } from './LanguageMiddlewareFeature';
import { FileModificationType, FileOperationResponse, ModifiedFileResponse, RenamedFileResponse } from "./protocol";
import { toRange2 } from './typeConversion';

export async function buildEditForResponse(changes: FileOperationResponse[], languageMiddlewareFeature: LanguageMiddlewareFeature, token: vscode.CancellationToken): Promise<boolean> {
    let edit: vscode.WorkspaceEdit = { changes: {}, documentChanges: [] };

    let fileToOpen: Uri | undefined;

    if (!changes || !Array.isArray(changes) || !changes.length) {
        return true;
    }

    for (const change of changes) {
        if (change.ModificationType == FileModificationType.Opened) {
            // The CodeAction requested that we open a file.
            // Record that file name and keep processing CodeActions.
            // If a CodeAction requests that we open multiple files
            // we only open the last one (what would it mean to open multiple files?)
            fileToOpen = vscode.Uri.file(change.FileName);
        }

        if (change.ModificationType == FileModificationType.Modified) {
            const modifiedChange = <ModifiedFileResponse>change;
            const uri = vscode.Uri.file(modifiedChange.FileName);
            let edits: vscode.TextEdit[] = [];
            for (let textChange of modifiedChange.Changes) {
                edits.push(vscode.TextEdit.replace(toRange2(textChange), textChange.NewText));
            }

            edit.changes[uri.toString()] = edits;
        }
    }

    for (const change of changes) {
        if (change.ModificationType == FileModificationType.Renamed) {
            const renamedChange = <RenamedFileResponse>change;
            edit.documentChanges.push({
                kind: 'rename',
                oldUri: vscode.Uri.file(renamedChange.FileName).toString(),
                newUri: vscode.Uri.file(renamedChange.NewFileName).toString(),
            });
        }
    }

    // Allow language middlewares to re-map its edits if necessary.
    edit = await languageMiddlewareFeature.remap("remapWorkspaceEdit", edit, token);

    const applyEditPromise = vscode.workspace.applyEdit(edit);

    // Unfortunately, the textEditor.Close() API has been deprecated
    // and replaced with a command that can only close the active editor.
    // If files were renamed that weren't the active editor, their tabs will
    // be left open and marked as "deleted" by VS Code
    return fileToOpen !== undefined
        ? applyEditPromise.then(res => {
            return vscode.commands.executeCommand("vscode.open", fileToOpen)
                .then(_ => res);
        })
        : applyEditPromise;
}
