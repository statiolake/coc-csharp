/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'coc.nvim';
import { OmniSharpServer } from '../omnisharp/server';
import AbstractProvider from './abstractProvider';
import * as protocol from '../omnisharp/protocol';
import * as serverUtils from '../omnisharp/utils';
import CompositeDisposable from '../CompositeDisposable';
import OptionProvider from '../observers/OptionProvider';
import { LanguageMiddlewareFeature } from '../omnisharp/LanguageMiddlewareFeature';
import { buildEditForResponse } from '../omnisharp/fileOperationsResponseEditBuilder';

export default class CodeActionProvider extends AbstractProvider implements vscode.CodeActionProvider<vscode.CodeAction> {
    private _commandId: string;

    constructor(server: OmniSharpServer, private optionProvider: OptionProvider, languageMiddlewareFeature: LanguageMiddlewareFeature) {
        super(server, languageMiddlewareFeature);
        this._commandId = 'omnisharp.runCodeAction';
        const registerCommandDisposable = vscode.commands.registerCommand(this._commandId, this._runCodeAction, this);
        this.addDisposables(new CompositeDisposable(registerCommandDisposable));
    }

    public async provideCodeActions(document: vscode.TextDocument, range: vscode.Range, context: vscode.CodeActionContext, token: vscode.CancellationToken): Promise<vscode.CodeAction[]> {
        const options = this.optionProvider.GetLatestOptions();
        if (options.disableCodeActions) {
            return;
        }

        const line = range.start.line;
        const column = range.start.character;

        const request: protocol.V2.GetCodeActionsRequest = {
            FileName: vscode.Uri.parse(document.uri).fsPath,
            Line: line,
            Column: column,
        };

        try {
            const response = await serverUtils.getCodeActions(this._server, request, token);
            return response.CodeActions.map(codeAction => {
                const runRequest: protocol.V2.RunCodeActionRequest = {
                    ...request,
                    Identifier: codeAction.Identifier,
                    WantsTextChanges: true,
                    WantsAllCodeActionOperations: true,
                    ApplyTextChanges: false
                };

                return {
                    title: codeAction.Name,
                    command: {
                        title: codeAction.Name,
                        command: this._commandId,
                        arguments: [runRequest, token]
                    },
                };
            });
        } catch (error) {
            return Promise.reject(`Problem invoking 'GetCodeActions' on OmniSharp server: ${error}`);
        }
    }

    private async _runCodeAction(req: protocol.V2.RunCodeActionRequest, token: vscode.CancellationToken): Promise<boolean | string | {}> {
        try {
            const response = await serverUtils.runCodeAction(this._server, req);
            if (response) {
                return buildEditForResponse(response.Changes, this._languageMiddlewareFeature, token);
            }
        } catch (error) {
            return Promise.reject(`Problem invoking 'RunCodeAction' on OmniSharp server: ${error}`);
        }
    }
}
