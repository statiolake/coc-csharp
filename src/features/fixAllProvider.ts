/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'coc.nvim';
import * as serverUtils from '../omnisharp/utils';
import * as protocol from '../omnisharp/protocol';
import { OmniSharpServer } from '../omnisharp/server';
import { FixAllScope, FixAllItem } from '../omnisharp/protocol';
import CompositeDisposable from '../CompositeDisposable';
import AbstractProvider from './abstractProvider';
import { LanguageMiddlewareFeature } from '../omnisharp/LanguageMiddlewareFeature';
import { buildEditForResponse } from '../omnisharp/fileOperationsResponseEditBuilder';
import { CancellationToken } from 'vscode-languageserver-protocol';

export class FixAllProvider extends AbstractProvider implements vscode.CodeActionProvider {
    public static fixAllCodeActionKind = vscode.CodeActionKind.SourceFixAll;

    public static metadata: vscode.CodeActionProviderMetadata = {
      providedCodeActionKinds: [FixAllProvider.fixAllCodeActionKind]
    };

    public constructor(private server: OmniSharpServer, languageMiddlewareFeature: LanguageMiddlewareFeature) {
        super(server, languageMiddlewareFeature);
        let disposable = new CompositeDisposable();
        disposable.add(vscode.commands.registerCommand('o.fixAll.solution', async () => this.fixAllMenu(server, protocol.FixAllScope.Solution)));
        disposable.add(vscode.commands.registerCommand('o.fixAll.project', async () => this.fixAllMenu(server, protocol.FixAllScope.Project)));
        disposable.add(vscode.commands.registerCommand('o.fixAll.document', async () => this.fixAllMenu(server, protocol.FixAllScope.Document)));
        this.addDisposables(disposable);
    }

    public async provideCodeActions(
        document: vscode.TextDocument,
        _range: vscode.Range,
        context: vscode.CodeActionContext,
        _token: vscode.CancellationToken,
    ): Promise<vscode.CodeAction[]> {
        console.log(context);
        if (!context.only) {
            return [];
        }

        if (context.only.indexOf(FixAllProvider.fixAllCodeActionKind) >= 0) {
            await this.applyFixes(vscode.Uri.parse(document.uri).fsPath, FixAllScope.Document, undefined);
        }

        return [];
    }

    private async fixAllMenu(server: OmniSharpServer, scope: protocol.FixAllScope): Promise<void> {
        let availableFixes = await serverUtils.getFixAll(
            server,
            {
                FileName: vscode.Uri.parse(
                        vscode.window.activeTextEditor.document.uri
                    ).fsPath,
                Scope: scope
            });

        let targets: vscode.QuickPickItem[]
            = availableFixes.Items.map(x => ({
                label: `${x.Id}: ${x.Message}`
            }));

        if (scope === protocol.FixAllScope.Document) {
            targets = [{
                label: "Fix all issues", ...targets
            }];
        }

        return vscode.window.showQuickPick(targets, {
            canPickMany: false,
            matchOnDescription: true,
            title: `Select fix all action`
        }).then(async selectedAction => {
            let filter: FixAllItem[] = undefined;

            if (selectedAction === undefined) {
                return;
            }

            if (selectedAction.label !== "Fix all issues") {
                let actionTokens = selectedAction.label.split(":");
                filter = [{ Id: actionTokens[0], Message: actionTokens[1] }];
            }

            await this.applyFixes(
                vscode.Uri.parse(
                    vscode.window.activeTextEditor.document.uri
                ).fsPath,
                scope,
                filter
            );
        });
    }

    private async applyFixes(fileName: string, scope: FixAllScope, fixAllFilter: FixAllItem[]): Promise<boolean | string | {}> {
        let response = await serverUtils.runFixAll(this.server, {
            FileName: fileName,
            Scope: scope,
            FixAllFilter: fixAllFilter,
            WantsAllCodeActionOperations: true,
            WantsTextChanges: true,
            ApplyChanges: false
        });

        if (response) {
            return buildEditForResponse(response.Changes, this._languageMiddlewareFeature, CancellationToken.None);
        }
    }
}
