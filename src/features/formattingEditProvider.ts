/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'coc.nvim';
import AbstractSupport from './abstractProvider';
import * as protocol from '../omnisharp/protocol';
import * as serverUtils from '../omnisharp/utils';
import { DocumentRangeFormattingEditProvider, FormattingOptions, CancellationToken, TextEdit, TextDocument, Range, Position } from 'coc.nvim';

export default class FormattingSupport extends AbstractSupport implements DocumentRangeFormattingEditProvider {

    public async provideDocumentRangeFormattingEdits(document: TextDocument, range: Range, options: FormattingOptions, token: CancellationToken): Promise<TextEdit[]> {

        let request = <protocol.FormatRangeRequest>{
            FileName: vscode.Uri.parse(document.uri).fsPath,
            Line: range.start.line,
            Column: range.start.character,
            EndLine: range.end.line,
            EndColumn: range.end.character
        };

        try {
            let res = await serverUtils.formatRange(this._server, request, token);
            if (res && Array.isArray(res.Changes)) {
                return res.Changes.map(FormattingSupport._asEditOptionation);
            }
        }
        catch (error) {
            return [];
        }
    }

    public async provideOnTypeFormattingEdits(document: TextDocument, position: Position, ch: string, options: FormattingOptions, token: CancellationToken): Promise<TextEdit[]> {

        let request = <protocol.FormatAfterKeystrokeRequest>{
            FileName: vscode.Uri.parse(document.uri).fsPath,
            Line: position.line,
            Column: position.character,
            Character: ch
        };

        try {
            let res = await serverUtils.formatAfterKeystroke(this._server, request, token);
            if (res && Array.isArray(res.Changes)) {
                return res.Changes.map(FormattingSupport._asEditOptionation);
            }
        }
        catch (error) {
            return [];
        }
    }

    private static _asEditOptionation(change: protocol.TextChange): TextEdit {
        return TextEdit.replace(
            Range.create(change.StartLine, change.StartColumn, change.EndLine, change.EndColumn),
            change.NewText
        );
    }
}
