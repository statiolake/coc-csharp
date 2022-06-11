/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as coc from 'coc.nvim';
import { Uri } from 'coc.nvim';
import { LanguageMiddlewareFeature } from './LanguageMiddlewareFeature';
import { FileModificationType, FileOperationResponse, ModifiedFileResponse, RenamedFileResponse } from "./protocol";
import { toRange2 } from './typeConversion';

export async function buildEditForResponse(changes: FileOperationResponse[], languageMiddlewareFeature: LanguageMiddlewareFeature, token: coc.CancellationToken): Promise<boolean> {
    let edit: coc.WorkspaceEdit = {
        changes: {}
    };

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
            fileToOpen = coc.Uri.file(change.FileName);
        }

        if (change.ModificationType == FileModificationType.Modified) {
            const modifiedChange = <ModifiedFileResponse>change;
            const uri = coc.Uri.file(modifiedChange.FileName);
            let edits: coc.TextEdit[] = [];
            for (let textChange of modifiedChange.Changes) {
                edits.push(coc.TextEdit.replace(toRange2(textChange), textChange.NewText));
            }

            edit.changes[uri.toString()] = edits;
        }
    }

    edit.documentChanges = [];
    for (const change of changes) {
        if (change.ModificationType == FileModificationType.Renamed) {
            const renamedChange = <RenamedFileResponse>change;
            edit.documentChanges.push({
                kind: 'rename',
                oldUri: coc.Uri.file(renamedChange.FileName).toString(),
                newUri: coc.Uri.file(renamedChange.NewFileName).toString(),
            });
        }
    }

    // Allow language middlewares to re-map its edits if necessary.
    edit = await languageMiddlewareFeature.remap("remapWorkspaceEdit", edit, token);

    const applyEditPromise = coc.workspace.applyEdit(edit);

    // Unfortunately, the textEditor.Close() API has been deprecated
    // and replaced with a command that can only close the active editor.
    // If files were renamed that weren't the active editor, their tabs will
    // be left open and marked as "deleted" by VS Code
    return fileToOpen != null
        ? applyEditPromise.then(res => {
            coc.commands.executeCommand("vscode.open", fileToOpen);
            return res;
        })
        : applyEditPromise;
}
