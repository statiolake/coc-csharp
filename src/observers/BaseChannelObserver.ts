/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { BaseEvent } from '../omnisharp/loggingEvents';
import * as vscode from 'coc.nvim';

export abstract class BaseChannelObserver {

    constructor(private channel: vscode.OutputChannel) {
    }

    abstract post: (event: BaseEvent) => void;

    public showChannel(preserveFocus?: boolean) {
        this.channel.show(preserveFocus);
    }

    public clearChannel() {
        this.channel.clear();
    }
}