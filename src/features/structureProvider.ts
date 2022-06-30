/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { FoldingRangeProvider, TextDocument, FoldingContext, CancellationToken, FoldingRange } from "coc.nvim";
import AbstractSupport from './abstractProvider';
import { blockStructure } from "../omnisharp/utils";
import { Request } from "../omnisharp/protocol";
import * as vscode from 'coc.nvim';

export class StructureProvider extends AbstractSupport implements FoldingRangeProvider {
    async provideFoldingRanges(document: TextDocument, context: FoldingContext, token: CancellationToken): Promise<FoldingRange[]> {
        let request: Request = {
            FileName: vscode.Uri.parse(document.uri).fsPath,
        };

        try {
            let response = await blockStructure(this._server, request, token);
            let ranges: FoldingRange[] = [];
            for (let member of response.Spans) {
                ranges.push({
                    startLine: member.Range.Start.Line,
                    endLine: member.Range.End.Line,
                    kind: this.GetType(member.Kind),
                });
            }

            return ranges;
        }
        catch (error) {
            return [];
        }
    }

    GetType(type: string): string {
        switch (type) {
            case "Comment":
                return "comment";
            case "Imports":
                return "imports";
            case "Region":
                return "region";
            default:
                return null;
        }
    }

}