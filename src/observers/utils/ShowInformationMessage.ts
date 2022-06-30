/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import MessageItemWithCommand from "./MessageItemWithCommand";
import * as vscode from 'coc.nvim';

export default async function showInformationMessage(message: string, ...items: MessageItemWithCommand[]) {
    try {
        let value = await vscode.window.showInformationMessage<MessageItemWithCommand>(message, ...items);
        if (value && value.command) {
            vscode.commands.executeCommand(value.command);
        }
    }
    catch (err) {
        console.log(err);
    }
}