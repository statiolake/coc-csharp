/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'coc.nvim';

export default async function showErrorMessage(message: string, ...items: string[]) {
    try {
        await vscode.window.showErrorMessage(message, ...items);
    }
    catch (err) {
        console.log(err);
    }
}
