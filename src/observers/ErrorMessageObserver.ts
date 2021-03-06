/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { BaseEvent, ZipError, DotNetTestRunFailure, DotNetTestDebugStartFailure, IntegrityCheckFailure } from "../omnisharp/loggingEvents";
import showErrorMessage from "./utils/ShowErrorMessage";
import { EventType } from "../omnisharp/EventType";

export class ErrorMessageObserver {
    constructor() {
    }

    public post = (event: BaseEvent) => {
        switch (event.type) {
            case EventType.ZipError:
                this.handleZipError(<ZipError>event);
                break;
            case EventType.DotNetTestRunFailure:
                this.handleDotnetTestRunFailure(<DotNetTestRunFailure>event);
                break;
            case EventType.DotNetTestDebugStartFailure:
                this.handleDotNetTestDebugStartFailure(<DotNetTestDebugStartFailure>event);
                break;
            case EventType.IntegrityCheckFailure:
                this.handleIntegrityCheckFailure(<IntegrityCheckFailure>event);
        }
    }

    handleIntegrityCheckFailure(event: IntegrityCheckFailure) {
        if (!event.retry) {
            showErrorMessage(`Package ${event.packageDescription} download from ${event.url} failed integrity check. Some features may not work as expected. Please restart Visual Studio Code to retrigger the download`);
        }
    }

    private handleZipError(event: ZipError) {
        showErrorMessage(event.message);
    }

    private handleDotnetTestRunFailure(event: DotNetTestRunFailure) {
        showErrorMessage(`Failed to run test because ${event.message}.`);
    }

    private handleDotNetTestDebugStartFailure(event: DotNetTestDebugStartFailure) {
        showErrorMessage(`Failed to start debugger: ${event.message}`);
    }
}
