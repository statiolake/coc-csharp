/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'coc.nvim';
import { LanguageMiddlewareFeature } from './LanguageMiddlewareFeature';
import { FileModificationType, FileOperationResponse, ModifiedFileResponse, RenamedFileResponse } from "./protocol";
import { toRange2 } from './typeConversion';

export async function buildEditForResponse(changes: FileOperationResponse[], languageMiddlewareFeature: LanguageMiddlewareFeature, token: vscode.CancellationToken): Promise<boolean> {
    let editChanges: vscode.WorkspaceEdit = { changes: {} };
    let editDocumentChanges: vscode.WorkspaceEdit = { documentChanges: [] };

    if (!changes || !Array.isArray(changes) || !changes.length) {
        return true;
    }

    for (const change of changes) {
        if (change.ModificationType == FileModificationType.Modified) {
            const modifiedChange = <ModifiedFileResponse>change;
            const uri = vscode.Uri.file(modifiedChange.FileName);
            let edits: vscode.TextEdit[] = [];
            for (let textChange of modifiedChange.Changes) {
                edits.push(vscode.TextEdit.replace(toRange2(textChange), textChange.NewText));
            }

            editChanges.changes[uri.toString()] = edits;
        }
    }

    for (const change of changes) {
        if (change.ModificationType == FileModificationType.Renamed) {
            const renamedChange = <RenamedFileResponse>change;
            editDocumentChanges.documentChanges.push({
                kind: 'rename',
                oldUri: vscode.Uri.file(renamedChange.FileName).toString(),
                newUri: vscode.Uri.file(renamedChange.NewFileName).toString(),
            });
        }
    }

    // Allow language middlewares to re-map its edits if necessary.
    editChanges = await languageMiddlewareFeature.remap(
        "remapWorkspaceEdit", editChanges, token
    );
    editDocumentChanges = await languageMiddlewareFeature.remap(
        "remapWorkspaceEdit", editDocumentChanges, token
    );

    let res = true;
    res = await vscode.workspace.applyEdit(editDocumentChanges) && res;
    res = await vscode.workspace.applyEdit(editChanges) && res;
    return res;
}
