/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { BaseChannelObserver } from "./BaseChannelObserver";
import { BaseEvent, OmnisharpServerOnStdErr } from '../omnisharp/loggingEvents';
import { EventType } from "../omnisharp/EventType";
import * as vscode from 'coc.nvim';

export class OmnisharpChannelObserver extends BaseChannelObserver {
    constructor(channel: vscode.OutputChannel) {
        super(channel);
    }

    public post = (event: BaseEvent) => {
        switch (event.type) {
            case EventType.ShowOmniSharpChannel:
            case EventType.OmnisharpFailure:
                this.showChannel(true);
                break;
            case EventType.OmnisharpServerOnStdErr:
                this.handleOmnisharpServerOnStdErr(<OmnisharpServerOnStdErr>event);
                break;
            case EventType.OmnisharpRestart:
                this.clearChannel();
                break;
        }
    }

    private async handleOmnisharpServerOnStdErr(event: OmnisharpServerOnStdErr) {
        let csharpConfig = vscode.workspace.getConfiguration('csharp');
        if (csharpConfig.get<boolean>('showOmnisharpLogOnError')) {
            this.showChannel(true);
        }
    }
}