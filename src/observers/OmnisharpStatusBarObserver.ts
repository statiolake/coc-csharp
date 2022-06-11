/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { BaseEvent } from "../omnisharp/loggingEvents";
import { BaseStatusBarItemObserver } from './BaseStatusBarItemObserver';
import { EventType } from "../omnisharp/EventType";

export enum StatusBarColors {
    Red = 'rgb(218,0,0)',
    Green = 'rgb(0,218,0)',
    Yellow = 'rgb(218,218,0)'
}

export class OmnisharpStatusBarObserver extends BaseStatusBarItemObserver {
    public post = (event: BaseEvent) => {
        switch (event.type) {
            case EventType.OmnisharpServerOnServerError:
                this.SetAndShowStatusBar('$(flame)');
                break;
            case EventType.OmnisharpServerOnStdErr:
                this.SetAndShowStatusBar('$(flame)');
                break;
            case EventType.OmnisharpOnBeforeServerInstall:
                this.SetAndShowStatusBar('$(flame) Installing OmniSharp...');
                break;
            case EventType.OmnisharpOnBeforeServerStart:
                this.SetAndShowStatusBar('$(flame)');
                break;
            case EventType.OmnisharpServerOnStop:
                this.ResetAndHideStatusBar();
                break;
            case EventType.OmnisharpServerOnStart:
                this.SetAndShowStatusBar('$(flame)');
                break;
            case EventType.DownloadStart:
                this.SetAndShowStatusBar("$(cloud-download) Downloading packages");
                break;
            case EventType.InstallationStart:
                this.SetAndShowStatusBar("$(desktop-download) Installing packages...");
                break;
            case EventType.InstallationSuccess:
                this.ResetAndHideStatusBar();
                break;
            case EventType.DownloadProgress:
                this.SetAndShowStatusBar("$(cloud-download) Downloading packages");
                break;
        }
    }
}

