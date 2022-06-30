/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { BaseEvent, OpenURL } from "../omnisharp/loggingEvents";
import { EventType } from "../omnisharp/EventType";
import * as vscode from 'coc.nvim';

export class OpenURLObserver {

    constructor() {
    }

    public post = (event: BaseEvent) => {
        switch (event.type) {
            case EventType.OpenURL:
                let url = (<OpenURL>event).url;
                vscode.commands.executeCommand("vscode.open", vscode.Uri.parse(url));
                break;
        }
    }
}