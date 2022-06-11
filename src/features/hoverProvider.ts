/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import AbstractSupport from './abstractProvider';
import * as protocol from '../omnisharp/protocol';
import * as serverUtils from '../omnisharp/utils';
import { createRequest } from '../omnisharp/typeConversion';
import { HoverProvider, Hover, TextDocument, CancellationToken, Position, MarkupKind } from 'coc.nvim';

export default class OmniSharpHoverProvider extends AbstractSupport implements HoverProvider {

    public async provideHover(document: TextDocument, position: Position, token: CancellationToken): Promise<Hover> {
        let request = createRequest<protocol.QuickInfoRequest>(document, position);
        try {
            const response = await serverUtils.getQuickInfo(this._server, request, token);
            if (!response || !response.Markdown) {
                return undefined;
            }

            const contents = {
                kind: MarkupKind.Markdown,
                value: response.Markdown,
            };

            return { contents };
        }
        catch (error) {
            return undefined;
        }
    }
}
