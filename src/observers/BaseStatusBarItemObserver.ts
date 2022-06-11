/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'coc.nvim';
import { BaseEvent } from '../omnisharp/loggingEvents';

export abstract class BaseStatusBarItemObserver {

    constructor(private statusBarItem: vscode.StatusBarItem) {
    }

    public SetAndShowStatusBar(text: string) {
        this.statusBarItem.text = text;
        this.statusBarItem.show();
    }

    public ResetAndHideStatusBar() {
        this.statusBarItem.text = undefined;
        this.statusBarItem.hide();
    }

    abstract post: (event: BaseEvent) => void;
}