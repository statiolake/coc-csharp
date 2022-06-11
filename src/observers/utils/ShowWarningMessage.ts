/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import MessageItemWithCommand from "./MessageItemWithCommand";
import * as coc from 'coc.nvim';

export default async function showWarningMessage(message: string, ...items: MessageItemWithCommand[]) {
    try {
        let value = await coc.window.showWarningMessage<MessageItemWithCommand>(message, ...items);
        if (value && value.command) {
            await coc.commands.executeCommand<string>(value.command);
        }
    }
    catch (err) {
        console.log(err);
    }
}