/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as coc from 'coc.nvim';

export default interface MessageItemWithCommand extends coc.MessageItem {
    title: string,
    command: string;
}
