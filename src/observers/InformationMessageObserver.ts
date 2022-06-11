/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as ObservableEvent from "../omnisharp/loggingEvents";
import * as vscode from 'coc.nvim';
import showInformationMessage from "./utils/ShowInformationMessage";
import { EventType } from "../omnisharp/EventType";

export class InformationMessageObserver {
    constructor() {
    }

    public post = (event: ObservableEvent.BaseEvent) => {
        switch (event.type) {
            case EventType.OmnisharpServerUnresolvedDependencies:
                this.handleOmnisharpServerUnresolvedDependencies(<ObservableEvent.OmnisharpServerUnresolvedDependencies>event);
                break;
        }
    }

    private async handleOmnisharpServerUnresolvedDependencies(event: ObservableEvent.OmnisharpServerUnresolvedDependencies) {
        //to do: determine if we need the unresolved dependencies message
        let csharpConfig = vscode.workspace.getConfiguration('csharp');
        if (!csharpConfig.get<boolean>('suppressDotnetRestoreNotification')) {
            let message = `There are unresolved dependencies. Please execute the restore command to continue.`;
            return showInformationMessage(message, { title: "Restore", command: "dotnet.restore.all" });
        }
    }
}
