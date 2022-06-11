/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as coc from 'coc.nvim';

const dotnetPackExtensionId = 'ms-dotnettools.vscode-dotnet-pack';

export interface DotnetPackExtensionExports {
    getDotnetPath(version?: string): Promise<string | undefined>;
}

export async function getDotnetPackApi(): Promise<DotnetPackExtensionExports> {
    // @ts-ignore
    const dotnetExtension: coc.Extension = coc.extensions.getExtension<DotnetPackExtensionExports>(dotnetPackExtensionId);
    if (!dotnetExtension) {
        return null;
    }

    if (!dotnetExtension.isActive) {
        await dotnetExtension.activate();
    }

    return dotnetExtension.exports;
}